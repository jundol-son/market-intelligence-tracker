import { providerError } from './provider-error.ts';
import { alphaSourceFor } from './catalog.ts';

export type PriceBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export interface MarketDataProvider {
  getHistoricalPrices(symbol: string, start?: Date, end?: Date): Promise<PriceBar[]>;
}

export function calculateTreasurySpread(twoYear: PriceBar[], tenYear: PriceBar[]): PriceBar[] {
  const twoByDate = new Map(twoYear.map((row) => [row.date, row.close]));
  return tenYear.flatMap((row) => {
    const two = twoByDate.get(row.date);
    if (two === undefined) return [];
    const close = row.close - two;
    return [{ date: row.date, open: close, high: close, low: close, close, volume: 0 }];
  });
}

function bodyOf(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') throw new Error('시세 응답 형식이 올바르지 않습니다.');
  const body = input as Record<string, unknown>;
  const error = providerError(body);
  if (error) throw new Error(error);
  return body;
}

function numberField(row: Record<string, unknown>, label: string, fallback = Number.NaN) {
  const entry = Object.entries(row).find(([key]) => key.toLowerCase().includes(label));
  return entry ? Number(entry[1]) : fallback;
}

function parseOhlcSeries(input: unknown, seriesName: string): PriceBar[] {
  const body = bodyOf(input);
  const series = body[seriesName];
  if (!series || typeof series !== 'object') throw new Error('일봉 데이터가 응답에 없습니다.');

  const prices = Object.entries(series as Record<string, unknown>).flatMap(([date, raw]) => {
    if (!raw || typeof raw !== 'object') return [];
    const row = raw as Record<string, unknown>;
    const price = {
      date,
      open: numberField(row, 'open'),
      high: numberField(row, 'high'),
      low: numberField(row, 'low'),
      close: numberField(row, 'close'),
      volume: numberField(row, 'volume', 0),
    };
    return /^\d{4}-\d{2}-\d{2}$/.test(date)
      && Object.values(price).slice(1).every(Number.isFinite)
      && price.open > 0 && price.high > 0 && price.low > 0 && price.close > 0
      && price.high >= price.low && price.volume >= 0 ? [price] : [];
  }).sort((a, b) => a.date.localeCompare(b.date));

  if (!prices.length) throw new Error('유효한 일봉 데이터가 없습니다.');
  return prices;
}

export const parseAlphaVantageDaily = (input: unknown): PriceBar[] =>
  parseOhlcSeries(input, 'Time Series (Daily)');

export const parseAlphaVantageFxDaily = (input: unknown): PriceBar[] =>
  parseOhlcSeries(input, 'Time Series FX (Daily)');

export function parseAlphaVantageCryptoDaily(input: unknown): PriceBar[] {
  const body = bodyOf(input);
  const seriesName = Object.keys(body).find((key) => /time series.*digital currency daily/i.test(key));
  if (!seriesName) throw new Error('암호화폐 일봉 데이터가 응답에 없습니다.');
  return parseOhlcSeries(body, seriesName);
}

export function parseAlphaVantageScalar(input: unknown): PriceBar[] {
  const rows = bodyOf(input).data;
  if (!Array.isArray(rows)) throw new Error('경제지표 일봉 데이터가 응답에 없습니다.');
  const prices = rows.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const row = raw as Record<string, unknown>;
    const date = typeof row.date === 'string' ? row.date : '';
    const value = Number(row.value);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(value) && value > 0
      ? [{ date, open: value, high: value, low: value, close: value, volume: 0 }]
      : [];
  }).sort((a, b) => a.date.localeCompare(b.date));
  if (!prices.length) throw new Error('유효한 경제지표 데이터가 없습니다.');
  return prices;
}

export class AlphaVantageProvider implements MarketDataProvider {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getHistoricalPrices(symbol: string, start?: Date, end?: Date): Promise<PriceBar[]> {
    const source = alphaSourceFor(symbol);
    if (source.kind === 'DERIVED') throw new Error(`${symbol}은 다른 지표에서 계산되므로 API를 호출하지 않습니다.`);
    if (source.kind === 'UNAVAILABLE') throw new Error(`${symbol}은 아직 무료 데이터 소스가 연결되지 않았습니다.`);
    const url = new URL('https://www.alphavantage.co/query');
    const params = new URLSearchParams({ apikey: this.apiKey });
    if (source.kind === 'STOCK') {
      Object.entries({ function: 'TIME_SERIES_DAILY', symbol: source.symbol, outputsize: 'compact' })
        .forEach(([key, value]) => params.set(key, value));
    } else if (source.kind === 'FX') {
      Object.entries({ function: 'FX_DAILY', from_symbol: source.from, to_symbol: source.to, outputsize: 'full' })
        .forEach(([key, value]) => params.set(key, value));
    } else if (source.kind === 'CRYPTO') {
      Object.entries({ function: 'DIGITAL_CURRENCY_DAILY', symbol: source.symbol, market: source.market })
        .forEach(([key, value]) => params.set(key, value));
    } else {
      params.set('function', source.function);
      Object.entries(source.params ?? {}).forEach(([key, value]) => params.set(key, value));
    }
    url.search = params.toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`시세 공급자 요청 실패 (${response.status})`);
    const input = await response.json();
    const prices = source.kind === 'STOCK' ? parseAlphaVantageDaily(input)
      : source.kind === 'FX' ? parseAlphaVantageFxDaily(input)
        : source.kind === 'CRYPTO' ? parseAlphaVantageCryptoDaily(input)
          : parseAlphaVantageScalar(input);
    const from = start?.toISOString().slice(0, 10);
    const to = end?.toISOString().slice(0, 10);
    return prices.filter((price) => (!from || price.date >= from) && (!to || price.date <= to)).slice(-260);
  }
}
