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

export function parseAlphaVantageDaily(input: unknown): PriceBar[] {
  if (!input || typeof input !== 'object') throw new Error('시세 응답 형식이 올바르지 않습니다.');
  const body = input as Record<string, unknown>;
  const providerError = body['Error Message'] ?? body.Note ?? body.Information;
  if (typeof providerError === 'string') throw new Error(providerError);
  const series = body['Time Series (Daily)'];
  if (!series || typeof series !== 'object') throw new Error('일봉 데이터가 응답에 없습니다.');

  const prices = Object.entries(series as Record<string, unknown>).flatMap(([date, raw]) => {
    if (!raw || typeof raw !== 'object') return [];
    const row = raw as Record<string, unknown>;
    const price = {
      date,
      open: Number(row['1. open']),
      high: Number(row['2. high']),
      low: Number(row['3. low']),
      close: Number(row['4. close']),
      volume: Number(row['5. volume']),
    };
    return /^\d{4}-\d{2}-\d{2}$/.test(date)
      && Object.values(price).slice(1).every(Number.isFinite)
      && price.open > 0 && price.high > 0 && price.low > 0 && price.close > 0
      && price.high >= price.low && price.volume >= 0 ? [price] : [];
  }).sort((a, b) => a.date.localeCompare(b.date));

  if (!prices.length) throw new Error('유효한 일봉 데이터가 없습니다.');
  return prices;
}

export class AlphaVantageProvider implements MarketDataProvider {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getHistoricalPrices(symbol: string, start?: Date, end?: Date): Promise<PriceBar[]> {
    const url = new URL('https://www.alphavantage.co/query');
    url.search = new URLSearchParams({
      function: 'TIME_SERIES_DAILY', symbol, outputsize: 'compact', apikey: this.apiKey,
    }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`시세 공급자 요청 실패 (${response.status})`);
    const prices = parseAlphaVantageDaily(await response.json());
    const from = start?.toISOString().slice(0, 10);
    const to = end?.toISOString().slice(0, 10);
    return prices.filter((price) => (!from || price.date >= from) && (!to || price.date <= to));
  }
}
