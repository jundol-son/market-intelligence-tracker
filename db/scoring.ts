import { getDb } from './index';
import { calculateAssetScore, DEFAULT_WEIGHTS, type ScoreInput, type ScoreWeight, weightedMarketScore } from '@/lib/scoring';

type ScorableAsset = ScoreInput & {
  id: number;
  market: string;
  importanceWeight: number;
  date: string;
  newsScore: number | null;
};

export async function getWeights(): Promise<ScoreWeight[]> {
  const result = await getDb().prepare(`SELECT score_group AS scoreGroup, metric_key AS metricKey,
    weight, enabled FROM score_weights ORDER BY score_group, id`).all<ScoreWeight>();
  return result.results.length ? result.results.map((item) => ({ ...item, enabled: Boolean(item.enabled) })) : DEFAULT_WEIGHTS;
}

export async function saveWeights(weights: ScoreWeight[]): Promise<void> {
  const db = getDb();
  await db.batch(weights.map((item) => db.prepare(`INSERT INTO score_weights
    (score_group, metric_key, weight, enabled) VALUES (?, ?, ?, ?)
    ON CONFLICT(score_group, metric_key) DO UPDATE SET weight=excluded.weight,
      enabled=excluded.enabled, updated_at=CURRENT_TIMESTAMP`)
    .bind(item.scoreGroup, item.metricKey, item.weight, item.enabled ? 1 : 0)));
}

async function priorScores(assetId: number, date: string) {
  const result = await getDb().prepare(`SELECT composite_score AS score FROM asset_scores
    WHERE asset_id=? AND date<? ORDER BY date DESC LIMIT 5`).bind(assetId, date).all<{ score: number }>();
  return result.results;
}

const average = (rows: Array<{ score: number; weight: number }>) => {
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  return total ? rows.reduce((sum, row) => sum + row.score * row.weight, 0) / total : null;
};

export async function recalculateScores() {
  const db = getDb();
  const weights = await getWeights();
  // ponytail: score the latest stored date only; add an explicit offline backfill when replay is required.
  const input = await db.prepare(`SELECT a.id, a.market, a.importance_weight AS importanceWeight,
    p.date, p.close, i.ma20_distance AS ma20Distance, i.ma60_distance AS ma60Distance,
    i.ma20_slope AS ma20Slope, i.ma60_slope AS ma60Slope, i.rsi14, i.atr14,
    i.return_5d AS return5d, i.return_20d AS return20d,
    i.relative_strength AS relativeStrength,
    (SELECT n.score FROM news_scores n WHERE n.asset_id=a.id ORDER BY n.date DESC LIMIT 1) AS newsScore
    FROM assets a JOIN asset_prices p ON p.id=(SELECT p2.id FROM asset_prices p2
      WHERE p2.asset_id=a.id ORDER BY p2.date DESC LIMIT 1)
    JOIN asset_indicators i ON i.asset_id=a.id AND i.date=p.date WHERE a.enabled=1`).all<ScorableAsset>();

  const scored = [] as Array<ScorableAsset & { compositeScore: number }>;
  for (const asset of input.results) {
    const score = calculateAssetScore(asset, weights);
    const prior = await priorScores(asset.id, asset.date);
    await db.prepare(`INSERT INTO asset_scores
      (asset_id, date, trend_score, momentum_score, risk_score, technical_score,
        news_score, relative_score, composite_score, score_change_1d, score_change_5d)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(asset_id, date) DO UPDATE SET trend_score=excluded.trend_score,
        momentum_score=excluded.momentum_score, risk_score=excluded.risk_score,
        technical_score=excluded.technical_score, news_score=excluded.news_score,
        relative_score=excluded.relative_score,
        composite_score=excluded.composite_score, score_change_1d=excluded.score_change_1d,
        score_change_5d=excluded.score_change_5d`)
      .bind(asset.id, asset.date, score.trendScore, score.momentumScore, score.riskScore,
        score.technicalScore, asset.newsScore, score.relativeScore, score.compositeScore,
        prior[0] ? score.compositeScore - prior[0].score : null,
        prior[4] ? score.compositeScore - prior[4].score : null).run();
    scored.push({ ...asset, compositeScore: score.compositeScore });
  }

  if (!scored.length) return { assets: 0, market: null };
  const korea = (market: string) => /^(KR|KOSPI|KOSDAQ|KRX)/.test(market.toUpperCase());
  const globalScore = average(scored.filter((item) => !korea(item.market)).map((item) => ({ score: item.compositeScore, weight: item.importanceWeight })));
  const koreaScore = average(scored.filter((item) => korea(item.market)).map((item) => ({ score: item.compositeScore, weight: item.importanceWeight })));
  const overallScore = weightedMarketScore(globalScore, koreaScore, weights) ?? 50;
  const date = scored.map((item) => item.date).sort().at(-1)!;
  const priorMarket = await db.prepare(`SELECT overall_score AS overallScore, global_score AS globalScore,
    korea_score AS koreaScore FROM market_scores WHERE date<? ORDER BY date DESC LIMIT 1`)
    .bind(date).first<{ overallScore: number; globalScore: number | null; koreaScore: number | null }>();
  await db.prepare(`INSERT INTO market_scores
    (date, overall_score, global_score, korea_score, overall_change, global_change, korea_change, market_regime)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET overall_score=excluded.overall_score,
      global_score=excluded.global_score, korea_score=excluded.korea_score,
      overall_change=excluded.overall_change, global_change=excluded.global_change,
      korea_change=excluded.korea_change, market_regime=excluded.market_regime`)
    .bind(date, overallScore, globalScore, koreaScore,
      priorMarket ? overallScore - priorMarket.overallScore : null,
      priorMarket && globalScore !== null && priorMarket.globalScore !== null ? globalScore - priorMarket.globalScore : null,
      priorMarket && koreaScore !== null && priorMarket.koreaScore !== null ? koreaScore - priorMarket.koreaScore : null,
      overallScore >= 65 ? 'RISK_ON' : overallScore <= 35 ? 'RISK_OFF' : 'NEUTRAL').run();
  return { assets: scored.length, market: { date, overallScore, globalScore, koreaScore } };
}

export async function getLatestMarketScore() {
  return getDb().prepare(`SELECT date, overall_score AS overallScore, global_score AS globalScore,
    korea_score AS koreaScore, overall_change AS overallChange, global_change AS globalChange,
    korea_change AS koreaChange, market_regime AS marketRegime
    FROM market_scores ORDER BY date DESC LIMIT 1`).first();
}

export async function listScoreHistory(limit = 30) {
  const db = getDb();
  const [market, assets] = await Promise.all([
    db.prepare(`SELECT date, overall_score AS overallScore, global_score AS globalScore,
      korea_score AS koreaScore, overall_change AS overallChange, global_change AS globalChange,
      korea_change AS koreaChange, market_regime AS marketRegime
      FROM market_scores ORDER BY date DESC LIMIT ?`).bind(limit).all(),
    db.prepare(`SELECT s.date, s.asset_id AS assetId, a.symbol, s.trend_score AS trendScore,
      s.momentum_score AS momentumScore, s.risk_score AS riskScore,
      s.technical_score AS technicalScore, s.relative_score AS relativeScore,
      s.composite_score AS compositeScore, s.score_change_1d AS scoreChange1d,
      s.score_change_5d AS scoreChange5d FROM asset_scores s JOIN assets a ON a.id=s.asset_id
      WHERE s.date IN (SELECT date FROM market_scores ORDER BY date DESC LIMIT ?)
      ORDER BY s.date DESC, a.symbol`).bind(limit).all(),
  ]);
  return { market: market.results, assets: assets.results };
}
