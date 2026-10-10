import assert from 'node:assert/strict';
import { calculateNewsScore, detectDivergence, isDuplicateEvent, NaverNewsProvider, parseAlphaVantageNews, parseNaverNews, selectPeriodicNewsTarget, selectPeriodicNewsTargets } from './news.ts';

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
const targets = ['NVDA', 'SPY', 'CRYPTO:BTC'];
const slot = 21_600_000;
assert.deepEqual([0, 1, 2, 3].map((index) => selectPeriodicNewsTarget(targets, new Date(index * slot))), ['NVDA', 'SPY', 'CRYPTO:BTC', 'NVDA']);
assert.equal(selectPeriodicNewsTarget([], new Date(0)), undefined);
assert.deepEqual(selectPeriodicNewsTargets(['A', 'B', 'C', 'D', 'E', 'F'], new Date(0), 3), ['A', 'B', 'C']);
assert.deepEqual(selectPeriodicNewsTargets(['A', 'B', 'C', 'D', 'E', 'F'], new Date(slot), 3), ['D', 'E', 'F']);
const naver = parseNaverNews({ items: [{
  title: '<b>삼성전자</b>, 반도체 투자 확대', description: 'AI &amp; 반도체 생산을 늘립니다.',
  originallink: 'https://news.example.kr/article/1', link: 'https://n.news.naver.com/article/1',
  pubDate: 'Tue, 29 Sep 2026 10:00:00 +0900',
}] }, '삼성전자');
assert.equal(naver[0].title, '삼성전자, 반도체 투자 확대');
assert.equal(naver[0].summary, 'AI & 반도체 생산을 늘립니다.');
assert.equal(naver[0].source, 'NAVER Search · news.example.kr');
assert.equal(naver[0].sentiment, 'UNANALYZED');
assert.equal(naver[0].impactScore, 0);
assert.equal(parseNaverNews({ items: [{ title: '잘못된 링크', originallink: 'http://', pubDate: 'Tue, 29 Sep 2026 10:00:00 +0900' }] }, '잘못된 링크').length, 0);
assert.equal(parseNaverNews({ items: [{
  title: '비트코인 가격 급등', description: '시장에서는 브렌트유도 함께 언급됐다.',
  originallink: 'https://crypto.example.kr/1', pubDate: 'Tue, 29 Sep 2026 10:00:00 +0900',
}] }, '브렌트유').length, 0);
assert.equal(parseNaverNews({ items: [{
  title: 'SK하이닉스 퇴직자, 악성림프종 투병', description: '회사에서 오래 근무한 개인의 사연입니다.',
  originallink: 'https://people.example.kr/1', pubDate: 'Tue, 29 Sep 2026 10:00:00 +0900',
}] }, 'SK하이닉스').length, 0);
const diverse = parseNaverNews({ items: [
  { title: '브렌트유 가격 상승 1', originallink: 'https://a.example.kr/1', pubDate: 'Tue, 29 Sep 2026 10:00:00 +0900' },
  { title: '브렌트유 가격 상승 2', originallink: 'https://a.example.kr/2', pubDate: 'Tue, 29 Sep 2026 09:00:00 +0900' },
  { title: '브렌트유 가격 상승 3', originallink: 'https://a.example.kr/3', pubDate: 'Tue, 29 Sep 2026 08:00:00 +0900' },
  { title: '브렌트유 가격 하락', originallink: 'https://b.example.kr/1', pubDate: 'Tue, 29 Sep 2026 07:00:00 +0900' },
] }, '브렌트유');
assert.equal(diverse.length, 3);
assert.deepEqual(diverse.map((item) => item.source), [
  'NAVER Search · a.example.kr', 'NAVER Search · a.example.kr', 'NAVER Search · b.example.kr',
]);
const originalFetch = globalThis.fetch;
let naverRequest: { url?: string; headers?: HeadersInit } = {};
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  naverRequest = { url, headers: init?.headers };
  return new Response(JSON.stringify({ items: [] }));
};
try {
  await new NaverNewsProvider('client-id', 'client-secret').getNews('삼성전자');
  assert.match(naverRequest.url!, /^https:\/\/openapi\.naver\.com\/v1\/search\/news\.json\?/);
  assert.deepEqual(naverRequest.headers, {
    'X-Naver-Client-Id': 'client-id', 'X-Naver-Client-Secret': 'client-secret',
  });
} finally {
  globalThis.fetch = originalFetch;
}
assert.equal(parseAlphaVantageNews({ feed: [{
  title: 'Unrelated company merely mentions Nvidia', summary: 'Brief mention.', source: 'Example',
  url: 'https://example.com/mention', time_published: '20260906T100000',
  ticker_sentiment: [{ ticker: 'NVDA', relevance_score: '0.69', ticker_sentiment_score: '0.2' }],
}] }, 'NVDA').length, 0);
assert.throws(
  () => parseAlphaVantageNews({ Information: 'API key SECRET reached 25 requests per day' }, 'NVDA'),
  (error: unknown) => error instanceof Error && !error.message.includes('SECRET') && /호출 한도/.test(error.message),
);
assert.throws(
  () => parseAlphaVantageNews({ Information: 'This endpoint is for premium users only. API key SECRET' }, 'NVDA'),
  (error: unknown) => error instanceof Error && !error.message.includes('SECRET') && /무료 플랜/.test(error.message),
);
assert.equal(detectDivergence(-1.2, 70), 'PRICE_DOWN_NEWS_POSITIVE');
assert.equal(detectDivergence(1.2, 30), 'PRICE_UP_NEWS_NEGATIVE');
assert.equal(detectDivergence(0.1, 30), null);

console.log('news engine: ok');
