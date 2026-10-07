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
assert.deepEqual(result.forecastCalibration, {
  count: 4, modelBrier: 0.21, baselineBrier: 0.3403, brierSkill: 38.29,
  minimumSample: 30, sufficientSample: false,
});
assert.deepEqual(result.calibrationCurve.find((bucket) => bucket.min === 60), {
  min: 60, max: 80, count: 4, predictedUpProbability: 60, observedUpRate: 75,
  gap: 15, minimumSample: 10, sufficientSample: false,
});
assert.deepEqual(result.walkForward.map((period) => [period.period, period.count]), [
  ['2026-01', 2], ['2025-12', 1], ['2025-10', 1],
]);
assert.equal(result.scorePerformance.find((bucket) => bucket.min === 70)?.averageReturn, 1);
const decimalBoundaries = buildAnalytics([29.5, 44.5, 54.5, 69.5, 79.5]
  .map((score) => row('2026-01-31', 'NEUTRAL', score, 0, true, true)));
assert.equal(decimalBoundaries.scorePerformance.reduce((sum, bucket) => sum + bucket.count, 0), 5);
const perAssetBaseline = buildAnalytics([
  { ...row('2026-01-01', 'NEUTRAL', 50, 1, true, true), symbol: 'A' },
  { ...row('2026-01-01', 'NEUTRAL', 50, -1, true, true), symbol: 'B' },
  { ...row('2026-01-02', 'NEUTRAL', 50, -1, true, true), symbol: 'A' },
  { ...row('2026-01-02', 'NEUTRAL', 50, 1, true, true), symbol: 'B' },
]);
assert.equal(perAssetBaseline.forecastCalibration.baselineBrier, 0.625);
const enoughSamples = buildAnalytics(Array.from({ length: 30 }, () => row('2026-01-31', 'NEUTRAL', 50, 1, true, true)));
assert.equal(enoughSamples.forecastCalibration.sufficientSample, true);
assert.equal(enoughSamples.calibrationCurve.find((bucket) => bucket.min === 60)?.sufficientSample, true);
assert.deepEqual(buildAnalytics([]).direction30, { count: 0, accuracy: null });
assert.deepEqual(buildAnalytics([]).forecastCalibration,
  { count: 0, modelBrier: null, baselineBrier: null, brierSkill: null, minimumSample: 30, sufficientSample: false });
console.log('analytics checks passed');
