import assert from 'node:assert/strict';
import {
  emailMessage, notificationDue, parseEmailRecipients, parseNotificationSettings, telegramCommandMessage, telegramMessage,
  type NotificationPayload,
} from './notification.ts';
import { summarizeDataFreshness } from './data-freshness.ts';

const payload: NotificationPayload = {
  reportId: 7, reportDate: '2026-09-04', overallScore: 64.5, globalScore: 64.5,
  koreaScore: null, summary: '중립 환경입니다.', upProbability: 50.8,
  expectedLow: -2.35, expectedHigh: 2.33, responseLevel: '변동성 확대 대비',
  metrics: [{ symbol: 'NVDA', name: 'NVIDIA <Corp>', priceDate: '2026-08-31', price: 230.36, dailyReturn: 1.2,
    compositeScore: 64, trendScore: 70, momentumScore: 60, riskScore: 55, newsScore: 70 }],
  news: [{ title: 'New & notable', sentiment: 'POSITIVE', impactScore: 80 }],
  events: [{ eventName: 'US CPI', scheduledAt: '2026-09-11T12:30:00Z', expectedImpact: 95 }],
};

const settings = parseNotificationSettings({ settings: [
  { channel: 'TELEGRAM', enabled: true, sendTime: '08:00', timezone: 'Asia/Seoul' },
  { channel: 'EMAIL', enabled: false, sendTime: '08:15', timezone: 'America/New_York' },
] });
assert.equal(settings.length, 2);
assert.throws(() => parseNotificationSettings({ settings: [] }));
assert.deepEqual(parseEmailRecipients({ recipients: [' First@Example.com ', 'first@example.com', 'two@example.com'] }),
  ['first@example.com', 'two@example.com']);
assert.throws(() => parseEmailRecipients({ recipients: ['not-an-email'] }), /올바르지/);

assert.equal(notificationDue(new Date('2026-09-07T23:00:00Z'), '08:00', 'Asia/Seoul').due, true);
assert.equal(notificationDue(new Date('2026-09-07T22:59:00Z'), '08:00', 'Asia/Seoul').due, false);

assert.match(telegramMessage(payload, 'https://example.com'), /Up Probability   50\.8%/);
assert.match(telegramMessage(payload, 'https://example.com'), /Data Check/);
assert.match(telegramCommandMessage('/nvda', payload, 'https://example.com'), /NVIDIA <Corp>/);
assert.match(telegramCommandMessage('/missing', payload, 'https://example.com'), /찾지 못했습니다/);
const email = emailMessage(payload, 'https://example.com');
assert.match(email.html, /NVIDIA &lt;Corp&gt;/);
assert.doesNotMatch(email.html, /NVIDIA <Corp>/);
assert.match(email.html, /데이터 기준일 확인/);
assert.deepEqual(summarizeDataFreshness([
  { symbol: 'A', date: '2026-09-04' }, { symbol: 'B', date: '2026-08-31' }, { symbol: 'C', date: null },
], '2026-09-04'), {
  referenceDate: '2026-09-04', current: [{ symbol: 'A', date: '2026-09-04' }],
  delayed: [{ symbol: 'B', date: '2026-08-31', lagDays: 4 }], missing: [{ symbol: 'C', date: null }], total: 3,
});
assert.throws(() => summarizeDataFreshness([], '2026-02-31'), /YYYY-MM-DD/);

console.log('notification tests passed');
