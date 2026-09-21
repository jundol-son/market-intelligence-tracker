import assert from 'node:assert/strict';
import { parseBlsCalendar } from './economic-calendar.ts';

const events = parseBlsCalendar(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:cpi-2026
DTSTART;TZID=US-Eastern:20260911T083000
SUMMARY:Consumer Price Index
END:VEVENT
BEGIN:VEVENT
UID:minor-2026
DTSTART:20260912T123000Z
SUMMARY:Import and Export Price Indexes
END:VEVENT
END:VCALENDAR`);

assert.equal(events.length, 1);
assert.deepEqual(events[0], {
  externalId: 'cpi-2026',
  eventName: 'Consumer Price Index',
  eventType: 'CPI',
  country: 'US',
  scheduledAt: '2026-09-11T12:30:00.000Z',
  expectedImpact: 95,
  status: 'SCHEDULED',
  sourceUrl: 'https://www.bls.gov/schedule/news_release/bls.ics',
});
assert.throws(() => parseBlsCalendar('<html>Denied</html>'), /올바르지/);
