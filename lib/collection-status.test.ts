import assert from 'node:assert/strict';
import { summarizeCollectionJobs, type CollectionJob } from './collection-status.ts';

const jobs: CollectionJob[] = [
  { id: 5, jobName: 'NAVER_API:NEWS:PERIODIC:2026-10-11:3', startedAt: '2026-10-11 18:00:00', finishedAt: '2026-10-11 18:00:02', status: 'FAILED', errorMessage: 'rate limited' },
  { id: 4, jobName: 'NAVER_API:NEWS:PERIODIC:2026-10-11:2', startedAt: '2026-10-11 12:00:00', finishedAt: '2026-10-11 12:00:02', status: 'SUCCESS', errorMessage: null },
  { id: 3, jobName: 'DAILY_KIS:2026-10-11', startedAt: '2026-10-11 16:10:00', finishedAt: '2026-10-11 16:11:00', status: 'SUCCESS', errorMessage: null },
  { id: 2, jobName: 'CALENDAR:BLS_V2:2026-10-11', startedAt: '2026-10-11 09:00:00', finishedAt: '2026-10-11 09:00:01', status: 'SUCCESS', errorMessage: null },
  { id: 1, jobName: 'NOTIFICATION_CRON', startedAt: '2026-10-11 08:00:00', finishedAt: '2026-10-11 08:00:01', status: 'SUCCESS', errorMessage: null },
];

const result = summarizeCollectionJobs(jobs, [{ enabled: true, sendTime: '08:00' }], new Date('2026-10-11T13:00:00Z'));
const news = result.find((item) => item.key === 'NEWS');
assert.equal(news?.latest?.status, 'FAILED');
assert.equal(news?.lastSuccess?.id, 4);
assert.equal(news?.lastFailure?.errorMessage, 'rate limited');
assert.equal(news?.nextRunAt, '2026-10-11T15:00:00.000Z');

const price = result.find((item) => item.key === 'PRICE');
assert.equal(price?.lastSuccess?.id, 3);
assert.equal(price?.nextRunAt, '2026-10-12T07:10:00.000Z');

const notification = result.find((item) => item.key === 'NOTIFICATION');
assert.equal(notification?.nextRunAt, '2026-10-11T23:00:00.000Z');
assert.equal(summarizeCollectionJobs([], [], new Date('2026-10-11T13:00:00Z'))[3].nextRunAt, null);

console.log('collection status tests passed');
