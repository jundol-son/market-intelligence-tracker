import assert from 'node:assert/strict';
import { parseEconomicEventInput } from './economic-event.ts';

const event = parseEconomicEventInput({
  eventName: '  US CPI  ', eventType: 'CPI', country: 'us', scheduledAt: '2026-09-11T12:30:00Z',
  previousValue: '2.7%', consensusValue: '', actualValue: null, expectedImpact: 95,
  status: 'SCHEDULED', sourceUrl: 'https://www.bls.gov/', affectedAssetIds: [1, 1, 2],
});
assert.equal(event.eventName, 'US CPI');
assert.equal(event.country, 'US');
assert.deepEqual(event.affectedAssetIds, [1, 2]);
assert.throws(() => parseEconomicEventInput({ ...event, expectedImpact: 101 }), /0~100/);
assert.throws(() => parseEconomicEventInput({ ...event, scheduledAt: 'later' }), /예정 시각/);
assert.throws(() => parseEconomicEventInput({ ...event, sourceUrl: 'javascript:alert(1)' }), /http/);

console.log('economic-event tests passed');
