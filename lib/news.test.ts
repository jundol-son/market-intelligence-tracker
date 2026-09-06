import assert from 'node:assert/strict';
import { calculateNewsScore, detectDivergence, isDuplicateEvent, parseAlphaVantageNews } from './news.ts';

const article = (title: string) => ({ title, category: 'Earnings' as const, eventTime: '2026-09-06T10:00:00Z' });
assert.equal(isDuplicateEvent(article('Nvidia revenue rises on AI demand'), article('AI demand lifts Nvidia revenue')), true);
assert.equal(isDuplicateEvent(article('Nvidia revenue rises on AI demand'), { ...article('Fed holds interest rates'), category: 'Monetary Policy' }), false);

const parsed = parseAlphaVantageNews({ feed: [{
  title: 'Nvidia raises guidance', summary: 'Demand remains strong.', source: 'Reuters',
  url: 'https://example.com/nvda', time_published: '20260906T100000', overall_sentiment_score: '0.4',
  topics: [{ topic: 'earnings', relevance_score: '0.9' }],
  ticker_sentiment: [{ ticker: 'NVDA', relevance_score: '0.8', ticker_sentiment_score: '0.5' }],
}] }, 'NVDA');
assert.equal(parsed.length, 1);
assert.equal(parsed[0].category, 'Earnings');
assert.equal(parsed[0].sentiment, 'POSITIVE');
assert.equal(parsed[0].impactScore, 62);
assert.ok(calculateNewsScore(parsed) > 50);
assert.equal(parseAlphaVantageNews({ feed: [{
  title: 'Unrelated company merely mentions Nvidia', summary: 'Brief mention.', source: 'Example',
  url: 'https://example.com/mention', time_published: '20260906T100000',
  ticker_sentiment: [{ ticker: 'NVDA', relevance_score: '0.69', ticker_sentiment_score: '0.2' }],
}] }, 'NVDA').length, 0);
assert.throws(
  () => parseAlphaVantageNews({ Information: 'API key SECRET reached 25 requests per day' }, 'NVDA'),
  (error: unknown) => error instanceof Error && !error.message.includes('SECRET') && /호출 한도/.test(error.message),
);
assert.equal(detectDivergence(-1.2, 70), 'PRICE_DOWN_NEWS_POSITIVE');
assert.equal(detectDivergence(1.2, 30), 'PRICE_UP_NEWS_NEGATIVE');
assert.equal(detectDivergence(0.1, 30), null);

console.log('news engine: ok');
