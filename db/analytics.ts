import { getDb } from './index';
import { buildAnalytics, type AnalyticsRow } from '@/lib/analytics';

export async function getAnalytics() {
  const rows = await getDb().prepare(`SELECT r.report_date AS reportDate,
    m.symbol, r.market_regime AS marketRegime, r.overall_score AS overallScore,
    m.composite_score AS compositeScore, f.up_probability AS upProbability,
    f.expected_low AS expectedLow, f.expected_high AS expectedHigh,
    x.actual_return AS actualReturn, x.direction_hit AS directionHit,
    x.range_hit AS rangeHit
    FROM forecast_results x JOIN forecasts f ON f.id=x.forecast_id
    JOIN reports r ON r.id=f.report_id
    LEFT JOIN report_metrics m ON m.report_id=f.report_id AND m.asset_id=f.target_asset_id
    ORDER BY r.report_date DESC, f.id DESC LIMIT 2000`).all<AnalyticsRow>();
  return buildAnalytics(rows.results);
}
