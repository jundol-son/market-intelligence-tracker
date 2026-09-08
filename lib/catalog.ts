import type { AssetInput } from './asset.ts';

export type AlphaSource =
  | { kind: 'STOCK'; symbol: string }
  | { kind: 'FX'; from: string; to: string }
  | { kind: 'CRYPTO'; symbol: string; market: string }
  | { kind: 'SCALAR'; function: 'TREASURY_YIELD' | 'WTI' | 'BRENT' | 'GOLD_SILVER_HISTORY'; params?: Record<string, string> }
  | { kind: 'DERIVED' }
  | { kind: 'UNAVAILABLE' };

type CatalogAsset = AssetInput & { source: AlphaSource; newsTicker?: string };

const asset = (
  symbol: string, name: string, assetType: AssetInput['assetType'], market: string,
  currency: string, importanceWeight: number, source: AlphaSource, enabled = true,
  newsTicker?: string,
): CatalogAsset => ({
  symbol, name, assetType, market, currency, benchmarkAssetId: null, groupId: null,
  enabled, importanceWeight, source, newsTicker,
});

export const DEFAULT_ASSETS: readonly CatalogAsset[] = [
  asset('SP500', 'S&P 500 (SPY proxy)', 'INDEX', 'GLOBAL', 'USD', 20, { kind: 'STOCK', symbol: 'SPY' }, true, 'SPY'),
  asset('NASDAQ100', 'Nasdaq 100 (QQQ proxy)', 'INDEX', 'GLOBAL', 'USD', 15, { kind: 'STOCK', symbol: 'QQQ' }, true, 'QQQ'),
  asset('SOX', 'Philadelphia Semiconductor (SOXX proxy)', 'INDEX', 'GLOBAL', 'USD', 10, { kind: 'STOCK', symbol: 'SOXX' }, true, 'SOXX'),
  asset('KOSPI', 'Korea equities (EWY proxy)', 'INDEX', 'KOSPI', 'USD', 20, { kind: 'STOCK', symbol: 'EWY' }, true, 'EWY'),
  asset('KOSDAQ', 'KOSDAQ (source connection required)', 'INDEX', 'KOSDAQ', 'KRW', 10, { kind: 'UNAVAILABLE' }, false),
  asset('USDKRW', 'USD/KRW', 'FX', 'FX', 'KRW', 8, { kind: 'FX', from: 'USD', to: 'KRW' }, true, 'FOREX:USD'),
  asset('USDJPY', 'USD/JPY', 'FX', 'FX', 'JPY', 5, { kind: 'FX', from: 'USD', to: 'JPY' }, true, 'FOREX:USD'),
  asset('DXY', 'US Dollar Index (UUP proxy)', 'FX', 'GLOBAL', 'USD', 8, { kind: 'STOCK', symbol: 'UUP' }, true, 'UUP'),
  asset('US2Y', 'US 2Y Treasury Yield', 'RATE', 'GLOBAL', 'PCT', 8, { kind: 'SCALAR', function: 'TREASURY_YIELD', params: { interval: 'daily', maturity: '2year' } }),
  asset('US10Y', 'US 10Y Treasury Yield', 'RATE', 'GLOBAL', 'PCT', 10, { kind: 'SCALAR', function: 'TREASURY_YIELD', params: { interval: 'daily', maturity: '10year' } }),
  asset('US10Y2Y', 'US 10Y - 2Y Treasury Spread', 'RATE', 'GLOBAL', 'PCT', 10, { kind: 'DERIVED' }),
  asset('VIX', 'Volatility (VIXY proxy)', 'INDEX', 'GLOBAL', 'USD', 10, { kind: 'STOCK', symbol: 'VIXY' }, true, 'VIXY'),
  asset('HY_OAS', 'High Yield credit (HYG proxy; inverse to OAS)', 'CREDIT', 'GLOBAL', 'USD', 8, { kind: 'STOCK', symbol: 'HYG' }, true, 'HYG'),
  asset('WTI', 'WTI crude oil', 'COMMODITY', 'GLOBAL', 'USD', 5, { kind: 'SCALAR', function: 'WTI', params: { interval: 'daily' } }),
  asset('BRENT', 'Brent crude oil', 'COMMODITY', 'GLOBAL', 'USD', 5, { kind: 'SCALAR', function: 'BRENT', params: { interval: 'daily' } }),
  asset('GOLD', 'Gold', 'COMMODITY', 'GLOBAL', 'USD', 5, { kind: 'SCALAR', function: 'GOLD_SILVER_HISTORY', params: { symbol: 'GOLD', interval: 'daily' } }),
  asset('BTC', 'Bitcoin / USD', 'CRYPTO', 'CRYPTO', 'USD', 5, { kind: 'CRYPTO', symbol: 'BTC', market: 'USD' }, true, 'CRYPTO:BTC'),
  asset('KR_FOREIGN_SPOT', 'Foreign investor KOSPI spot net buy (source connection required)', 'FLOW', 'KOSPI', 'KRW', 8, { kind: 'UNAVAILABLE' }, false),
  asset('KR_FOREIGN_FUTURES', 'Foreign investor KOSPI200 futures net buy (source connection required)', 'FLOW', 'KOSPI', 'KRW', 8, { kind: 'UNAVAILABLE' }, false),
  asset('SP500_ABOVE_200MA', 'S&P 500 members above 200MA (source connection required)', 'BREADTH', 'GLOBAL', 'USD', 5, { kind: 'UNAVAILABLE' }, false),
];

const catalog = new Map(DEFAULT_ASSETS.map((item) => [item.symbol, item]));

export const alphaSourceFor = (symbol: string): AlphaSource =>
  catalog.get(symbol.toUpperCase())?.source ?? { kind: 'STOCK', symbol };

export const newsTickerFor = (symbol: string): string | null => {
  const item = catalog.get(symbol.toUpperCase());
  return item ? item.newsTicker ?? null : symbol;
};

export const isCollectable = (symbol: string): boolean => {
  const kind = alphaSourceFor(symbol).kind;
  return kind !== 'DERIVED' && kind !== 'UNAVAILABLE';
};
