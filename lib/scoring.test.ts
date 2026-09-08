import assert from 'node:assert/strict';
import { calculateAssetScore, DEFAULT_WEIGHTS, orientScoreInput, parseWeights, weightedMarketScore } from './scoring.ts';

const strong = calculateAssetScore({
  close: 120, ma20Distance: 8, ma60Distance: 14, ma20Slope: 0.5, ma60Slope: 0.3,
  rsi14: 62, atr14: 3, return5d: 4, return20d: 12, relativeStrength: 5,
}, DEFAULT_WEIGHTS);
assert.ok(strong.compositeScore > 60);
assert.ok(Number.isFinite(strong.technicalScore));
assert.equal(weightedMarketScore(80, null, DEFAULT_WEIGHTS), 80);
assert.deepEqual(orientScoreInput({
  close: 4, ma20Distance: 2, ma60Distance: null, ma20Slope: 0.1, ma60Slope: null,
  rsi14: 70, atr14: 0.1, return5d: 3, return20d: -2, relativeStrength: 1,
}, true), {
  close: 4, ma20Distance: -2, ma60Distance: null, ma20Slope: -0.1, ma60Slope: null,
  rsi14: 30, atr14: 0.1, return5d: -3, return20d: 2, relativeStrength: -1,
});
assert.throws(() => parseWeights({ weights: DEFAULT_WEIGHTS.map((item) => ({ ...item, weight: 0.1 })) }), /합계/);
assert.equal(parseWeights({ weights: DEFAULT_WEIGHTS }).length, 6);
console.log('score engine: ok');
