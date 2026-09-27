import assert from 'node:assert/strict';
import { scheduledCollectionTasks } from './schedule.ts';

assert.deepEqual(scheduledCollectionTasks(new Date('2026-09-27T00:00:00Z')), {
  calendar: true, keylessMacro: false, news: false,
});
assert.deepEqual(scheduledCollectionTasks(new Date('2026-09-27T00:15:00Z')), {
  calendar: false, keylessMacro: true, news: false,
});
assert.deepEqual(scheduledCollectionTasks(new Date('2026-09-27T01:15:00Z')), {
  calendar: false, keylessMacro: true, news: false,
});
assert.equal(scheduledCollectionTasks(new Date('2026-09-27T03:30:00Z')).news, true);
assert.deepEqual(scheduledCollectionTasks(new Date('2026-09-27T03:45:00Z')), {
  calendar: false, keylessMacro: false, news: false,
});

console.log('schedule tests passed');
