import assert from 'node:assert/strict';
import { createForecast, findSimilarDays, responseLevel, type HistoricalDay } from './forecast.ts';

const current = { return1d: 1, return5d: 2, return20d: 5, ma20Distance: 3, ma60Distance: 7, rsi14: 60, atrPercent: 2, volumeRatio: 1.1 };
const history: HistoricalDay[] = Array.from({ length: 10 }, (_, index) => ({
  ...current,
  date: `2026-08-${String(index + 1).padStart(2, '0')}`,
  return1d: current.return1d + index / 10,
  nextDayReturn: index < 7 ? 1 + index / 10 : -1.5,
}));
const similar = findSimilarDays(current, history, 5);
assert.equal(similar.length, 5);
assert.equal(similar[0].date, '2026-08-01');
const forecast = createForecast(similar, 70, 60, 0);
assert.equal(forecast.upProbability + forecast.downProbability, 100);
assert.equal(forecast.bullProbability + forecast.baseProbability + forecast.bearProbability, 100);
assert.ok(forecast.expectedLow <= forecast.expectedHigh);
assert.ok(['관망', '변동성 확대 대비', '조정 시 매수 우위', '포지션 축소 고려', '추격매수 주의'].includes(responseLevel(forecast)));
assert.throws(() => createForecast(similar.slice(0, 4), 50, null, 0), /최소 5개/);

console.log('forecast engine: ok');
