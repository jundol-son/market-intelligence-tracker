import assert from 'node:assert/strict';
import { buildAnalytics, type AnalyticsRow } from './analytics.ts';

const row = (reportDate: string, marketRegime: string, compositeScore: number,
  actualReturn: number, directionHit: boolean, rangeHit: boolean): AnalyticsRow => ({
  reportDate, marketRegime, compositeScore, actualReturn, directionHit, rangeHit,
  symbol: 'NVDA', overallScore: compositeScore, upProbability: 60,
  expectedLow: -1, expectedHigh: 2,
});

const result = buildAnalytics([
  row('2026-01-31', 'RISK_ON', 75, 1, true, true),
  row('2026-01-15', 'RISK_OFF', 25, -2, false, false),
  row('2025-12-15', 'NEUTRAL', 50, 0.2, true, true),
  row('2025-10-01', 'RISK_ON', 90, 3, true, false),
]);
assert.deepEqual(result.direction30, { count: 2, accuracy: 50 });
assert.deepEqual(result.direction90, { count: 3, accuracy: 66.67 });
assert.equal(result.rangeHitRate, 50);
assert.deepEqual(result.riskOn, { count: 2, averageReturn: 2 });
assert.equal(result.scorePerformance.find((bucket) => bucket.min === 70)?.averageReturn, 1);
assert.deepEqual(buildAnalytics([]).direction30, { count: 0, accuracy: null });
console.log('analytics checks passed');
