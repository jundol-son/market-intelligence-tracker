import type { AssetInput } from './asset.ts';

export type AlphaSource =
  | { kind: 'STOCK'; symbol: string }
  | { kind: 'FX'; from: string; to: string }
  | { kind: 'CRYPTO'; symbol: string; market: string }
  | { kind: 'SCALAR'; function: 'TREASURY_YIELD' | 'WTI' | 'BRENT' | 'GOLD_SILVER_HISTORY'; params?: Record<string, string> }
  | { kind: 'DERIVED' }
  | { kind: 'UNAVAILABLE' };

export type KisSource =
  | { kind: 'DOMESTIC'; code: string }
  | { kind: 'INDEX'; code: string }
  | { kind: 'OVERSEAS'; code: string; exchange: 'NAS' | 'NYS' | 'AMS' };

export type FredSource = { series: 'DEXKOUS' | 'DEXJPUS' | 'DGS2' | 'DGS10' };

type CatalogAsset = AssetInput & { source: AlphaSource; newsTicker?: string; kisSource?: KisSource };

const asset = (
  symbol: string, name: string, assetType: AssetInput['assetType'], market: string,
  currency: string, importanceWeight: number, source: AlphaSource, enabled = true,
  newsTicker?: string, kisSource?: KisSource,
): CatalogAsset => ({
  symbol, name, assetType, market, currency, benchmarkAssetId: null, groupId: null,
  enabled, importanceWeight, source, newsTicker, kisSource,
});

export const DEFAULT_ASSETS: readonly CatalogAsset[] = [
  asset('SP500', 'S&P 500 (SPY proxy)', 'INDEX', 'GLOBAL', 'USD', 20, { kind: 'STOCK', symbol: 'SPY' }, true, 'SPY'),
  asset('NASDAQ100', 'Nasdaq 100 (QQQ proxy)', 'INDEX', 'GLOBAL', 'USD', 15, { kind: 'STOCK', symbol: 'QQQ' }, true, 'QQQ'),
  asset('SOX', 'Philadelphia Semiconductor (SOXX proxy)', 'INDEX', 'GLOBAL', 'USD', 10, { kind: 'STOCK', symbol: 'SOXX' }, true, 'SOXX'),
  asset('KOSPI', 'KOSPI', 'INDEX', 'KOSPI', 'KRW', 20, { kind: 'UNAVAILABLE' }, true, undefined, { kind: 'INDEX', code: '0001' }),
  asset('KOSDAQ', 'KOSDAQ', 'INDEX', 'KOSDAQ', 'KRW', 10, { kind: 'UNAVAILABLE' }, true, undefined, { kind: 'INDEX', code: '1001' }),
  asset('005930', '삼성전자', 'STOCK', 'KOSPI', 'KRW', 12, { kind: 'UNAVAILABLE' }, true, undefined, { kind: 'DOMESTIC', code: '005930' }),
  asset('000660', 'SK하이닉스', 'STOCK', 'KOSPI', 'KRW', 10, { kind: 'UNAVAILABLE' }, true, undefined, { kind: 'DOMESTIC', code: '000660' }),
  asset('091160', 'KODEX 반도체', 'ETF', 'KOSPI', 'KRW', 8, { kind: 'UNAVAILABLE' }, true, undefined, { kind: 'DOMESTIC', code: '091160' }),
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

const kisOverseas = new Map<string, KisSource>(Object.entries({
  SP500: { kind: 'OVERSEAS', code: 'SPY', exchange: 'AMS' },
  NASDAQ100: { kind: 'OVERSEAS', code: 'QQQ', exchange: 'NAS' },
  SOX: { kind: 'OVERSEAS', code: 'SOXX', exchange: 'NAS' },
  NVDA: { kind: 'OVERSEAS', code: 'NVDA', exchange: 'NAS' },
  DXY: { kind: 'OVERSEAS', code: 'UUP', exchange: 'AMS' },
  VIX: { kind: 'OVERSEAS', code: 'VIXY', exchange: 'AMS' },
  HY_OAS: { kind: 'OVERSEAS', code: 'HYG', exchange: 'AMS' },
  WTI: { kind: 'OVERSEAS', code: 'USO', exchange: 'AMS' },
  BRENT: { kind: 'OVERSEAS', code: 'BNO', exchange: 'AMS' },
  GOLD: { kind: 'OVERSEAS', code: 'GLD', exchange: 'AMS' },
  BTC: { kind: 'OVERSEAS', code: 'IBIT', exchange: 'NAS' },
} as const));

const fred = new Map<string, FredSource>(Object.entries({
  USDKRW: { series: 'DEXKOUS' }, USDJPY: { series: 'DEXJPUS' },
  US2Y: { series: 'DGS2' }, US10Y: { series: 'DGS10' },
} as const));

export const alphaSourceFor = (symbol: string): AlphaSource =>
  catalog.get(symbol.toUpperCase())?.source ?? { kind: 'STOCK', symbol };

export const kisSourceFor = (symbol: string): KisSource | null =>
  catalog.get(symbol.toUpperCase())?.kisSource ?? kisOverseas.get(symbol.toUpperCase())
    ?? (/^\d{6}$/.test(symbol) ? { kind: 'DOMESTIC', code: symbol } : null);

export const fredSourceFor = (symbol: string): FredSource | null => fred.get(symbol.toUpperCase()) ?? null;

export const newsTickerFor = (symbol: string): string | null => {
  const item = catalog.get(symbol.toUpperCase());
  return item ? item.newsTicker ?? null : symbol;
};

export const isCollectable = (symbol: string): boolean => {
  const kind = alphaSourceFor(symbol).kind;
  return Boolean(kisSourceFor(symbol) || fredSourceFor(symbol)) || (kind !== 'DERIVED' && kind !== 'UNAVAILABLE');
};
