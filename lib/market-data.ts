import { providerError } from './provider-error.ts';
import { alphaSourceFor, type KisSource } from './catalog.ts';

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

type KisBody = Record<string, unknown> & { rt_cd?: string; msg1?: string; output2?: unknown };
let kisTokenCache: { appKey: string; token: string; expiresAt: number } | undefined;
let kisTokenRequest: Promise<string> | undefined;

function parseKisDate(value: unknown): string {
  const raw = typeof value === 'string' ? value : '';
  return /^\d{8}$/.test(raw) ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6)}` : '';
}

export function parseKisPriceBars(input: unknown, kind: KisSource['kind']): PriceBar[] {
  if (!input || typeof input !== 'object') throw new Error('KIS 응답 형식이 올바르지 않습니다.');
  const body = input as KisBody;
  if (body.rt_cd !== '0') throw new Error(`KIS 시세 조회 실패: ${typeof body.msg1 === 'string' ? body.msg1 : '응답 오류'}`);
  if (!Array.isArray(body.output2)) throw new Error('KIS 일봉 데이터가 응답에 없습니다.');
  const fields = kind === 'INDEX'
    ? ['bstp_nmix_oprc', 'bstp_nmix_hgpr', 'bstp_nmix_lwpr', 'bstp_nmix_prpr']
    : ['stck_oprc', 'stck_hgpr', 'stck_lwpr', 'stck_clpr'];
  const prices = body.output2.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const row = raw as Record<string, unknown>;
    const [open, high, low, close] = fields.map((field) => Number(row[field]));
    const price = { date: parseKisDate(row.stck_bsop_date), open, high, low, close, volume: Number(row.acml_vol ?? 0) };
    return price.date && [open, high, low, close, price.volume].every(Number.isFinite)
      && open > 0 && high > 0 && low > 0 && close > 0 && high >= low && price.volume >= 0 ? [price] : [];
  }).sort((a, b) => a.date.localeCompare(b.date));
  if (!prices.length) throw new Error('유효한 KIS 일봉 데이터가 없습니다.');
  return prices;
}

async function requestKisToken(appKey: string, appSecret: string): Promise<string> {
  if (kisTokenCache?.appKey === appKey && kisTokenCache.expiresAt > Date.now() + 300_000) return kisTokenCache.token;
  if (kisTokenRequest) return kisTokenRequest;
  kisTokenRequest = (async () => {
    const response = await fetch('https://openapi.koreainvestment.com:9443/oauth2/tokenP', {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ grant_type: 'client_credentials', appkey: appKey, appsecret: appSecret }),
    });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    const token = typeof body.access_token === 'string' ? body.access_token : '';
    if (!response.ok || !token) throw new Error(`KIS 인증 실패 (${response.status})`);
    const expiresIn = Math.max(600, Number(body.expires_in) || 86_400);
    // ponytail: process cache fits this single-user Worker; add KV only if cold-start token churn becomes measurable.
    kisTokenCache = { appKey, token, expiresAt: Date.now() + expiresIn * 1_000 };
    return token;
  })();
  try {
    return await kisTokenRequest;
  } finally {
    kisTokenRequest = undefined;
  }
}

function compactDate(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

export class KisReadOnlyProvider implements MarketDataProvider {
  private readonly appKey: string;
  private readonly appSecret: string;
  private readonly source: KisSource;

  constructor(appKey: string, appSecret: string, source: KisSource) {
    this.appKey = appKey;
    this.appSecret = appSecret;
    this.source = source;
  }

  async getHistoricalPrices(_symbol: string, start?: Date, end?: Date): Promise<PriceBar[]> {
    const token = await requestKisToken(this.appKey, this.appSecret);
    const from = start ?? new Date((end?.getTime() ?? Date.now()) - 550 * 86_400_000);
    let pageEnd = end ?? new Date();
    const prices = new Map<string, PriceBar>();
    for (let page = 0; page < 3; page += 1) {
      const endpoint = this.source.kind === 'INDEX' ? 'inquire-daily-indexchartprice' : 'inquire-daily-itemchartprice';
      const url = new URL(`https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/${endpoint}`);
      const params: Record<string, string> = {
        FID_COND_MRKT_DIV_CODE: this.source.kind === 'INDEX' ? 'U' : 'J', FID_INPUT_ISCD: this.source.code,
        FID_INPUT_DATE_1: compactDate(from), FID_INPUT_DATE_2: compactDate(pageEnd), FID_PERIOD_DIV_CODE: 'D',
      };
      if (this.source.kind === 'DOMESTIC') params.FID_ORG_ADJ_PRC = '0';
      url.search = new URLSearchParams(params).toString();
      const response = await fetch(url, {
        headers: {
          'content-type': 'application/json', authorization: `Bearer ${token}`, appkey: this.appKey,
          appsecret: this.appSecret, tr_id: this.source.kind === 'INDEX' ? 'FHKUP03500100' : 'FHKST03010100', custtype: 'P',
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`KIS 시세 조회 실패 (${response.status})`);
      const rows = parseKisPriceBars(await response.json(), this.source.kind);
      rows.forEach((row) => prices.set(row.date, row));
      const oldest = rows[0]?.date;
      if (rows.length < 100 || !oldest || oldest <= from.toISOString().slice(0, 10)) break;
      pageEnd = new Date(`${oldest}T00:00:00Z`);
      pageEnd.setUTCDate(pageEnd.getUTCDate() - 1);
    }
    return [...prices.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-260);
  }
}
