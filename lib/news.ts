import { providerError } from './provider-error.ts';

export const NEWS_CATEGORIES = [
  'Monetary Policy', 'Macro Economy', 'Geopolitics', 'Government Policy', 'Earnings',
  'Guidance', 'M&A', 'Shareholder Return', 'Buyback', 'Dividend', 'Capital Raising',
  'Analyst Rating', 'Contract / Order', 'Regulation', 'Management Change',
  'Product Launch', 'Legal', 'Supply Chain', 'Other',
] as const;

export type NewsSentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'MIXED';
export type NewsDuration = 'INTRADAY' | 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM';

export type NewsArticle = {
  title: string;
  summary: string;
  category: typeof NEWS_CATEGORIES[number];
  eventTime: string;
  source: string;
  sourceUrl: string;
  sourceRank: number;
  sentiment: NewsSentiment;
  sentimentScore: number;
  impactScore: number;
  confidenceScore: number;
  durationType: NewsDuration;
  relevanceScore: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const number = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';

const TOPIC_CATEGORY: Record<string, typeof NEWS_CATEGORIES[number]> = {
  earnings: 'Earnings', mergers_and_acquisitions: 'M&A', economy_monetary: 'Monetary Policy',
  economy_macro: 'Macro Economy', economy_fiscal: 'Government Policy',
  manufacturing: 'Supply Chain', technology: 'Product Launch', financial_markets: 'Other',
};

function eventTime(value: unknown): string | null {
  const raw = text(value, 20);
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(raw);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
}

export function sourceRank(source: string, url: string): number {
  const value = `${source} ${url}`.toLowerCase();
  if (/sec\.gov|investor|relations|ir\./.test(value)) return 1;
  if (/federalreserve\.gov|central bank|bank of korea|ecb\.europa/.test(value)) return 2;
  if (/\.gov\b|government/.test(value)) return 3;
  if (/nasdaq\.com|nyse\.com|krx\.co/.test(value)) return 4;
  if (/reuters|associated press|bloomberg/.test(value)) return 5;
  if (/wall street journal|financial times|cnbc|marketwatch|barron/.test(value)) return 6;
  return 7;
}

function category(topics: unknown): typeof NEWS_CATEGORIES[number] {
  if (!Array.isArray(topics)) return 'Other';
  const best = topics.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .sort((a, b) => number(b.relevance_score) - number(a.relevance_score))[0];
  return TOPIC_CATEGORY[text(best?.topic, 80).toLowerCase()] ?? 'Other';
}

function duration(value: typeof NEWS_CATEGORIES[number]): NewsDuration {
  if (value === 'Analyst Rating') return 'INTRADAY';
  if (['Earnings', 'Guidance', 'Product Launch'].includes(value)) return 'SHORT_TERM';
  if (['Monetary Policy', 'Macro Economy', 'M&A', 'Regulation'].includes(value)) return 'LONG_TERM';
  return 'MEDIUM_TERM';
}

export function parseAlphaVantageNews(input: unknown, symbol: string): NewsArticle[] {
  if (!input || typeof input !== 'object') throw new Error('뉴스 응답 형식이 올바르지 않습니다.');
  const body = input as Record<string, unknown>;
  const error = providerError(body);
  if (error) throw new Error(error);
  if (!Array.isArray(body.feed)) throw new Error('뉴스 데이터가 응답에 없습니다.');

  return body.feed.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const row = raw as Record<string, unknown>;
    const title = text(row.title, 300);
    const sourceUrl = text(row.url, 1000);
    const published = eventTime(row.time_published);
    if (!title || !published || !/^https?:\/\//i.test(sourceUrl)) return [];
    const tickers = Array.isArray(row.ticker_sentiment) ? row.ticker_sentiment : [];
    const ticker = tickers.find((item) => item && typeof item === 'object'
      && text((item as Record<string, unknown>).ticker, 30).toUpperCase() === symbol.toUpperCase()) as Record<string, unknown> | undefined;
    if (!ticker) return [];
    const tickerScore = clamp(number(ticker.ticker_sentiment_score), -1, 1);
    const overallScore = clamp(number(row.overall_sentiment_score, tickerScore), -1, 1);
    const relevanceScore = clamp(number(ticker.relevance_score), 0, 1);
    const mixed = tickerScore * overallScore < -0.02;
    const sentiment: NewsSentiment = mixed ? 'MIXED'
      : tickerScore >= 0.15 ? 'POSITIVE' : tickerScore <= -0.15 ? 'NEGATIVE' : 'NEUTRAL';
    const eventCategory = category(row.topics);
    const source = text(row.source, 120) || 'Unknown';
    return [{
      title,
      summary: text(row.summary, 1200) || title,
      category: eventCategory,
      eventTime: published,
      source,
      sourceUrl,
      sourceRank: sourceRank(source, sourceUrl),
      sentiment,
      sentimentScore: tickerScore,
      impactScore: Math.round(clamp(Math.abs(tickerScore) * 60 + relevanceScore * 40, 0, 100)),
      confidenceScore: Math.round(relevanceScore * 100),
      durationType: duration(eventCategory),
      relevanceScore,
    }];
  });
}

const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'as', 'at', 'by', 'from']);
export function titleTokens(title: string): Set<string> {
  return new Set(title.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word)));
}

export function isDuplicateEvent(a: Pick<NewsArticle, 'title' | 'category' | 'eventTime'>, b: Pick<NewsArticle, 'title' | 'category' | 'eventTime'>): boolean {
  if (a.category !== b.category || Math.abs(Date.parse(a.eventTime) - Date.parse(b.eventTime)) > 172_800_000) return false;
  const left = titleTokens(a.title);
  const right = titleTokens(b.title);
  if (!left.size || !right.size) return a.title.toLowerCase() === b.title.toLowerCase();
  const overlap = [...left].filter((word) => right.has(word)).length;
  return overlap / Math.min(left.size, right.size) >= 0.6;
}

export function newsFingerprint(article: Pick<NewsArticle, 'title' | 'category' | 'eventTime'>): string {
  return `${article.eventTime.slice(0, 10)}|${article.category}|${[...titleTokens(article.title)].sort().slice(0, 16).join('-')}`;
}

export function calculateNewsScore(events: Array<Pick<NewsArticle, 'sentimentScore' | 'impactScore' | 'confidenceScore' | 'sourceRank'>>): number {
  if (!events.length) return 50;
  let weighted = 0;
  let total = 0;
  for (const event of events) {
    const trust = clamp(1.1 - event.sourceRank * 0.1, 0.3, 1);
    const weight = Math.max(1, event.impactScore) * Math.max(0.1, event.confidenceScore / 100) * trust;
    weighted += event.sentimentScore * weight;
    total += weight;
  }
  return Math.round(clamp(50 + 50 * weighted / total, 0, 100) * 10) / 10;
}

export function detectDivergence(return1d: number | null, newsScore: number): string | null {
  if (return1d === null) return null;
  if (return1d >= 0.5 && newsScore <= 40) return 'PRICE_UP_NEWS_NEGATIVE';
  if (return1d <= -0.5 && newsScore >= 60) return 'PRICE_DOWN_NEWS_POSITIVE';
  return null;
}

export interface NewsProvider {
  getNews(symbol: string): Promise<NewsArticle[]>;
}

export class AlphaVantageNewsProvider implements NewsProvider {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getNews(symbol: string): Promise<NewsArticle[]> {
    const url = new URL('https://www.alphavantage.co/query');
    url.search = new URLSearchParams({
      function: 'NEWS_SENTIMENT', tickers: symbol, sort: 'LATEST', limit: '50', apikey: this.apiKey,
    }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`뉴스 공급자 요청 실패 (${response.status})`);
    return parseAlphaVantageNews(await response.json(), symbol);
  }
}
