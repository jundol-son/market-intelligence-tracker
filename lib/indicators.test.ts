import assert from 'node:assert/strict';
import { calculateIndicators } from './indicators.ts';
import { parseAlphaVantageDaily, type PriceBar } from './market-data.ts';

const prices: PriceBar[] = Array.from({ length: 220 }, (_, index) => ({
  date: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10),
  open: 100 + index, high: 102 + index, low: 99 + index, close: 101 + index, volume: 1_000 + index,
}));
const latest = calculateIndicators(prices, prices.map((price) => ({ ...price, close: 100 })) ).at(-1)!;
assert.equal(latest.ma5, 318);
assert.equal(latest.rsi14, 100);
assert.ok(latest.atr14! > 0);
assert.ok(latest.return60d! > 0);
assert.ok(latest.relativeStrength! > 0);

const parsed = parseAlphaVantageDaily({
  'Time Series (Daily)': {
    '2026-09-05': { '1. open': '10', '2. high': '12', '3. low': '9', '4. close': '11', '5. volume': '100' },
  },
});
assert.equal(parsed[0].close, 11);
assert.throws(() => parseAlphaVantageDaily({ Note: 'rate limited' }), /rate limited/);
console.log('market data indicators: ok');
