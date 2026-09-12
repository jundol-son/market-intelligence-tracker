import assert from 'node:assert/strict';
import { calculateIndicators } from './indicators.ts';
import { DEFAULT_ASSETS, alphaSourceFor, isCollectable, kisSourceFor, newsTickerFor } from './catalog.ts';
import {
  parseAlphaVantageCryptoDaily, parseAlphaVantageDaily, parseAlphaVantageFxDaily,
  parseAlphaVantageScalar, calculateTreasurySpread, parseKisPriceBars, type PriceBar,
} from './market-data.ts';
import { isProviderDailyLimitError, PROVIDER_DAILY_LIMIT_MESSAGE } from './provider-error.ts';

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
assert.equal(DEFAULT_ASSETS.length, 23);
assert.deepEqual(alphaSourceFor('USDKRW'), { kind: 'FX', from: 'USD', to: 'KRW' });
assert.deepEqual(kisSourceFor('KOSPI'), { kind: 'INDEX', code: '0001' });
assert.deepEqual(kisSourceFor('005930'), { kind: 'DOMESTIC', code: '005930' });
assert.deepEqual(kisSourceFor('SP500'), { kind: 'OVERSEAS', code: 'SPY', exchange: 'AMS' });
assert.deepEqual(kisSourceFor('NVDA'), { kind: 'OVERSEAS', code: 'NVDA', exchange: 'NAS' });
assert.equal(isCollectable('KOSDAQ'), true);
assert.equal(isCollectable('US10Y2Y'), false);
assert.equal(newsTickerFor('BTC'), 'CRYPTO:BTC');
assert.equal(newsTickerFor('KOSDAQ'), null);
assert.equal(newsTickerFor('005930'), null);
assert.equal(parseKisPriceBars({ rt_cd: '0', output2: [{
  stck_bsop_date: '20260908', stck_oprc: '70000', stck_hgpr: '71000', stck_lwpr: '69000',
  stck_clpr: '70500', acml_vol: '123456',
}] }, 'DOMESTIC')[0].close, 70500);
assert.equal(parseKisPriceBars({ rt_cd: '0', output2: [{
  stck_bsop_date: '20260908', bstp_nmix_oprc: '3000', bstp_nmix_hgpr: '3050',
  bstp_nmix_lwpr: '2980', bstp_nmix_prpr: '3030', acml_vol: '789',
}] }, 'INDEX')[0].close, 3030);
assert.deepEqual(parseKisPriceBars({ rt_cd: '0', output2: [{
  xymd: '20260908', open: '175.25', high: '178.10', low: '174.80', clos: '177.90', tvol: '1234567',
}] }, 'OVERSEAS')[0], {
  date: '2026-09-08', open: 175.25, high: 178.1, low: 174.8, close: 177.9, volume: 1234567,
});
assert.ok(Math.abs(calculateTreasurySpread(
  [{ date: '2026-09-05', open: 4, high: 4, low: 4, close: 4, volume: 0 }],
  [{ date: '2026-09-05', open: 3.8, high: 3.8, low: 3.8, close: 3.8, volume: 0 }],
)[0].close + 0.2) < 1e-10);
assert.throws(
  () => parseAlphaVantageDaily({ Note: 'API key SECRET rate limited' }),
  (error: unknown) => error instanceof Error && !error.message.includes('SECRET') && /호출 한도/.test(error.message),
);
assert.equal(isProviderDailyLimitError(new Error(PROVIDER_DAILY_LIMIT_MESSAGE)), true);
assert.equal(isProviderDailyLimitError(new Error('데이터 공급자가 요청을 거부했습니다.')), false);
console.log('market data indicators: ok');
