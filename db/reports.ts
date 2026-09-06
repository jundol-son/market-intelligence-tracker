import { getDb } from './index';
import { getLatestMarketScore } from './scoring';
import { evaluateForecast, reportSummary } from '@/lib/report';

type MarketScore = {
  date: string;
  overallScore: number;
  globalScore: number | null;
  koreaScore: number | null;
  overallChange: number | null;
  marketRegime: string;
};

type MetricSnapshot = {
  assetId: number;
  symbol: string;
  name: string;
  price: number | null;
  dailyReturn: number | null;
  ma20: number | null;
  ma60: number | null;
  ma120: number | null;
  ma200: number | null;
  ma20Distance: number | null;
  ma60Distance: number | null;
  ma120Distance: number | null;
  ma200Distance: number | null;
  rsi: number | null;
  trendScore: number | null;
  momentumScore: number | null;
  riskScore: number | null;
  newsScore: number | null;
  compositeScore: number | null;
  scoreChange: number | null;
};

export async function generateDailyReport() {
  const db = getDb();
  const market = await getLatestMarketScore() as MarketScore | null;
  if (!market) throw new Error('리포트를 생성할 시장 점수가 없습니다. 먼저 가격을 수집하세요.');

  const existing = await db.prepare(`SELECT id FROM reports
    WHERE report_date=? AND report_type='DAILY'`).bind(market.date).first<{ id: number }>();
  if (existing) return { id: existing.id, created: false };

  const metrics = await db.prepare(`SELECT a.id AS assetId, a.symbol, a.name, p.close AS price,
    i.return_1d AS dailyReturn, i.ma20, i.ma60, i.ma120, i.ma200,
    i.ma20_distance AS ma20Distance, i.ma60_distance AS ma60Distance,
    i.ma120_distance AS ma120Distance, i.ma200_distance AS ma200Distance, i.rsi14 AS rsi,
    s.trend_score AS trendScore, s.momentum_score AS momentumScore,
    s.risk_score AS riskScore, s.news_score AS newsScore,
    s.composite_score AS compositeScore, s.score_change_1d AS scoreChange
    FROM assets a
    LEFT JOIN asset_prices p ON p.asset_id=a.id AND p.date=?
    LEFT JOIN asset_indicators i ON i.asset_id=a.id AND i.date=?
    LEFT JOIN asset_scores s ON s.asset_id=a.id AND s.date=?
    WHERE a.enabled=1 ORDER BY a.importance_weight DESC, a.symbol`)
    .bind(market.date, market.date, market.date).all<MetricSnapshot>();

  const summary = reportSummary(market.marketRegime, market.overallScore, market.overallChange);
  // ponytail: one prepared insert per tracked asset; replace with a bulk import only if the watchlist approaches D1's per-invocation query limit.
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO reports
      (report_date, report_type, overall_score, global_score, korea_score, market_regime, summary)
      VALUES (?, 'DAILY', ?, ?, ?, ?, ?)`)
      .bind(market.date, market.overallScore, market.globalScore, market.koreaScore, market.marketRegime, summary),
    ...metrics.results.map((item) => db.prepare(`INSERT OR IGNORE INTO report_metrics
      (report_id, asset_id, symbol, name, price, daily_return, ma20, ma60, ma120, ma200,
        ma20_distance, ma60_distance, ma120_distance, ma200_distance, rsi,
        trend_score, momentum_score, risk_score, news_score, composite_score, score_change)
      SELECT id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      FROM reports WHERE report_date=? AND report_type='DAILY'`)
      .bind(item.assetId, item.symbol, item.name, item.price, item.dailyReturn,
        item.ma20, item.ma60, item.ma120, item.ma200, item.ma20Distance, item.ma60Distance,
        item.ma120Distance, item.ma200Distance, item.rsi, item.trendScore, item.momentumScore,
        item.riskScore, item.newsScore, item.compositeScore, item.scoreChange, market.date)),
  ]);

  const report = await db.prepare(`SELECT id FROM reports
    WHERE report_date=? AND report_type='DAILY'`).bind(market.date).first<{ id: number }>();
  if (!report) throw new Error('리포트 저장에 실패했습니다.');
  return { id: report.id, created: true };
}

export async function listReports(limit = 90) {
  const result = await getDb().prepare(`SELECT r.id, r.report_date AS reportDate,
    r.report_type AS reportType, r.overall_score AS overallScore,
    r.global_score AS globalScore, r.korea_score AS koreaScore,
    r.market_regime AS marketRegime, r.summary, r.created_at AS createdAt,
    COUNT(m.id) AS metricCount FROM reports r LEFT JOIN report_metrics m ON m.report_id=r.id
    GROUP BY r.id ORDER BY r.report_date DESC, r.id DESC LIMIT ?`).bind(limit).all();
  return result.results;
}

export async function getReport(id: number) {
  const db = getDb();
  const report = await db.prepare(`SELECT id, report_date AS reportDate, report_type AS reportType,
    overall_score AS overallScore, global_score AS globalScore, korea_score AS koreaScore,
    market_regime AS marketRegime, summary, up_probability AS upProbability,
    down_probability AS downProbability, expected_low AS expectedLow,
    expected_high AS expectedHigh, bull_probability AS bullProbability,
    base_probability AS baseProbability, bear_probability AS bearProbability,
    confidence, created_at AS createdAt FROM reports WHERE id=?`).bind(id).first();
  if (!report) return null;
  const [metrics, forecastRows] = await Promise.all([
    db.prepare(`SELECT asset_id AS assetId, symbol, name, price, daily_return AS dailyReturn,
      ma20, ma60, ma120, ma200, ma20_distance AS ma20Distance,
      ma60_distance AS ma60Distance, ma120_distance AS ma120Distance,
      ma200_distance AS ma200Distance, rsi, trend_score AS trendScore,
      momentum_score AS momentumScore, risk_score AS riskScore, news_score AS newsScore,
      composite_score AS compositeScore, score_change AS scoreChange
      FROM report_metrics WHERE report_id=? ORDER BY composite_score DESC, symbol`).bind(id).all(),
    db.prepare(`SELECT f.id, f.target_asset_id AS targetAssetId, m.symbol,
      f.up_probability AS upProbability, f.down_probability AS downProbability,
      f.expected_low AS expectedLow, f.expected_high AS expectedHigh,
      f.bull_probability AS bullProbability, f.base_probability AS baseProbability,
      f.bear_probability AS bearProbability, f.confidence,
      x.actual_return AS actualReturn, x.direction_hit AS directionHit,
      x.range_hit AS rangeHit, x.evaluated_at AS evaluatedAt
      FROM forecasts f LEFT JOIN report_metrics m ON m.report_id=f.report_id AND m.asset_id=f.target_asset_id
      LEFT JOIN forecast_results x ON x.forecast_id=f.id WHERE f.report_id=? ORDER BY f.id`).bind(id).all(),
  ]);
  return { report, metrics: metrics.results, forecasts: forecastRows.results };
}

type PendingForecast = {
  id: number;
  reportDate: string;
  targetAssetId: number;
  initialPrice: number;
  actualPrice: number | null;
  upProbability: number;
  downProbability: number;
  expectedLow: number;
  expectedHigh: number;
};

export async function evaluateForecastResults() {
  const db = getDb();
  const pending = await db.prepare(`SELECT f.id, r.report_date AS reportDate,
    f.target_asset_id AS targetAssetId, m.price AS initialPrice,
    (SELECT p.close FROM asset_prices p WHERE p.asset_id=f.target_asset_id
      AND p.date>r.report_date ORDER BY p.date LIMIT 1) AS actualPrice,
    f.up_probability AS upProbability, f.down_probability AS downProbability,
    f.expected_low AS expectedLow, f.expected_high AS expectedHigh
    FROM forecasts f JOIN reports r ON r.id=f.report_id
    JOIN report_metrics m ON m.report_id=f.report_id AND m.asset_id=f.target_asset_id
    LEFT JOIN forecast_results x ON x.forecast_id=f.id
    WHERE x.id IS NULL AND m.price>0`).all<PendingForecast>();
  const ready = pending.results.filter((item) => item.actualPrice !== null);
  if (!ready.length) return 0;
  await db.batch(ready.map((item) => {
    const result = evaluateForecast(item.initialPrice, item.actualPrice!, item.upProbability,
      item.downProbability, item.expectedLow, item.expectedHigh);
    return db.prepare(`INSERT OR IGNORE INTO forecast_results
      (forecast_id, actual_return, direction_hit, range_hit) VALUES (?, ?, ?, ?)`)
      .bind(item.id, result.actualReturn, result.directionHit ? 1 : 0, result.rangeHit ? 1 : 0);
  }));
  return ready.length;
}
