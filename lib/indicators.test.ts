import assert from 'node:assert/strict';
import { calculateIndicators } from './indicators.ts';
import { DEFAULT_ASSETS, alphaSourceFor, isCollectable, newsTickerFor } from './catalog.ts';
import {
  parseAlphaVantageCryptoDaily, parseAlphaVantageDaily, parseAlphaVantageFxDaily,
  parseAlphaVantageScalar, calculateTreasurySpread, type PriceBar,
} from './market-data.ts';

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
assert.equal(parseAlphaVantageFxDaily({
  'Time Series FX (Daily)': {
    '2026-09-05': { '1. open': '1300', '2. high': '1310', '3. low': '1290', '4. close': '1305' },
  },
})[0].volume, 0);
assert.equal(parseAlphaVantageCryptoDaily({
  'Time Series (Digital Currency Daily)': {
    '2026-09-05': { '1a. open (USD)': '100', '2a. high (USD)': '110', '3a. low (USD)': '90', '4a. close (USD)': '105', '5. volume': '8' },
  },
})[0].close, 105);
assert.deepEqual(parseAlphaVantageScalar({ data: [
  { date: '2026-09-04', value: '4.25' }, { date: '2026-09-05', value: '.' },
] })[0], { date: '2026-09-04', open: 4.25, high: 4.25, low: 4.25, close: 4.25, volume: 0 });
assert.equal(DEFAULT_ASSETS.length, 20);
assert.deepEqual(alphaSourceFor('USDKRW'), { kind: 'FX', from: 'USD', to: 'KRW' });
assert.equal(isCollectable('US10Y2Y'), false);
assert.equal(newsTickerFor('BTC'), 'CRYPTO:BTC');
assert.equal(newsTickerFor('KOSDAQ'), null);
assert.ok(Math.abs(calculateTreasurySpread(
  [{ date: '2026-09-05', open: 4, high: 4, low: 4, close: 4, volume: 0 }],
  [{ date: '2026-09-05', open: 3.8, high: 3.8, low: 3.8, close: 3.8, volume: 0 }],
)[0].close + 0.2) < 1e-10);
assert.throws(
  () => parseAlphaVantageDaily({ Note: 'API key SECRET rate limited' }),
  (error: unknown) => error instanceof Error && !error.message.includes('SECRET') && /호출 한도/.test(error.message),
);
console.log('market data indicators: ok');
