import { listAssets } from './assets';
import { getDb } from './index';
import { fetchKisAssetInsight, fetchKisMarketInsight, type KisInsight, type KisMarketInsight } from '@/lib/kis-insights';
import { kisSourceFor } from '@/lib/catalog';

export type KisDashboard = {
  asOf: string | null;
  markets: KisMarketInsight[];
  assets: Exclude<KisInsight, KisMarketInsight>[];
  decision: { title: string; stance: 'POSITIVE' | 'NEUTRAL' | 'CAUTIOUS'; reasons: string[]; risks: string[]; nextChecks: string[] };
};

async function save(insight: KisInsight) {
  await getDb().prepare(`INSERT INTO kis_snapshots
    (snapshot_key, snapshot_date, scope, symbol, payload_json) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(snapshot_key, snapshot_date) DO UPDATE SET payload_json=excluded.payload_json,
      updated_at=CURRENT_TIMESTAMP`)
    .bind(`${insight.scope}:${insight.symbol}`, insight.date, insight.scope, insight.symbol, JSON.stringify(insight)).run();
}

export async function collectKisInsights(appKey: string, appSecret: string, now = new Date()) {
  const assets = (await listAssets()).filter((asset) => asset.enabled && kisSourceFor(asset.symbol)?.kind === 'DOMESTIC');
  const results: Array<{ symbol: string; status: 'SUCCESS' | 'FAILED'; error?: string }> = [];
  for (const symbol of ['KOSPI', 'KOSDAQ'] as const) {
    try { await save(await fetchKisMarketInsight(appKey, appSecret, symbol, now)); results.push({ symbol, status: 'SUCCESS' }); }
    catch (error) { results.push({ symbol, status: 'FAILED', error: error instanceof Error ? error.message : '조회 실패' }); }
  }
  for (const asset of assets) {
    try { await save(await fetchKisAssetInsight(appKey, appSecret, asset.symbol, now)); results.push({ symbol: asset.symbol, status: 'SUCCESS' }); }
    catch (error) { results.push({ symbol: asset.symbol, status: 'FAILED', error: error instanceof Error ? error.message : '조회 실패' }); }
  }
  return { requested: results.length, successful: results.filter((item) => item.status === 'SUCCESS').length, results };
}

function decision(markets: KisMarketInsight[], assets: KisDashboard['assets']): KisDashboard['decision'] {
  const breadth = markets.filter((item) => item.breadthPercent !== null).map((item) => item.breadthPercent!);
  const foreign = markets.reduce((sum, item) => sum + (item.foreignNetAmount ?? 0), 0);
  const institution = markets.reduce((sum, item) => sum + (item.institutionNetAmount ?? 0), 0);
  const positiveBreadth = breadth.length > 0 && breadth.reduce((a, b) => a + b, 0) / breadth.length >= 55;
  const weakBreadth = breadth.length > 0 && breadth.reduce((a, b) => a + b, 0) / breadth.length < 45;
  const stance = (positiveBreadth && foreign > 0) ? 'POSITIVE' : (weakBreadth || foreign < 0 && institution < 0) ? 'CAUTIOUS' : 'NEUTRAL';
  const netBuyers = assets.filter((item) => (item.foreignNetQty ?? 0) > 0).length;
  const warnings = assets.filter((item) => item.warnings.length > 0);
  return {
    stance,
    title: stance === 'POSITIVE' ? '수급과 시장폭이 함께 개선 중' : stance === 'CAUTIOUS' ? '방어적으로 확인할 구간' : '방향 확인이 더 필요한 중립 구간',
    reasons: [
      breadth.length ? `상승 종목 비중 평균 ${(breadth.reduce((a, b) => a + b, 0) / breadth.length).toFixed(1)}%` : '시장폭 데이터 대기',
      foreign === 0 ? '외국인 순매수대금 데이터 대기' : `외국인 양시장 합산 ${foreign > 0 ? '순매수' : '순매도'}`,
      `추적 종목 중 외국인 순매수 ${netBuyers}/${assets.length}개`,
    ],
    risks: [
      institution < 0 ? '기관이 양시장 합산 순매도' : '기관 수급은 급격한 이탈 없음',
      warnings.length ? `주의 상태: ${warnings.map((item) => item.symbol).join(', ')}` : '추적 종목 경고 상태 없음',
    ],
    nextChecks: ['외국인과 기관이 같은 방향인지', '상승 종목 비중이 50% 위를 유지하는지', '관심 종목의 외국인·프로그램 수급이 가격과 동행하는지'],
  };
}

export async function getKisDashboard(): Promise<KisDashboard> {
  const result = await getDb().prepare(`SELECT payload_json AS payloadJson FROM kis_snapshots s
    WHERE snapshot_date=(SELECT MAX(x.snapshot_date) FROM kis_snapshots x WHERE x.snapshot_key=s.snapshot_key)
    ORDER BY scope DESC, symbol`).all<{ payloadJson: string }>();
  const insights = result.results.flatMap(({ payloadJson }) => {
    try { return [JSON.parse(payloadJson) as KisInsight]; } catch { return []; }
  });
  const markets = insights.filter((item): item is KisMarketInsight => item.scope === 'MARKET');
  const assets = insights.filter((item): item is KisDashboard['assets'][number] => item.scope === 'ASSET');
  return { asOf: insights.map((item) => item.date).sort().at(-1) ?? null, markets, assets, decision: decision(markets, assets) };
}
