import assert from 'node:assert/strict';
import { summarizeMarketChanges } from './market-summary.ts';

const summary = summarizeMarketChanges([
  { symbol: 'AAA', name: 'Alpha', assetType: 'STOCK', importanceWeight: 2, enabled: true, compositeScore: 70, scoreChange1d: 3, return1d: 1 },
  { symbol: 'BBB', name: 'Beta', assetType: 'STOCK', importanceWeight: 1, enabled: true, compositeScore: 40, scoreChange1d: -1, return1d: -2 },
  { symbol: 'US10Y', name: 'US 10Y', assetType: 'RATE', importanceWeight: 3, enabled: true, compositeScore: 55, scoreChange1d: null, return1d: 0.5 },
  { symbol: 'OFF', name: 'Disabled', assetType: 'INDEX', importanceWeight: 100, enabled: false, compositeScore: 100, scoreChange1d: 99, return1d: 99 },
]);

assert.deepEqual(summary.keyChanges.map((item) => item.symbol), ['AAA', 'US10Y', 'BBB']);
assert.equal(summary.keyChanges[1].kind, 'RETURN');
assert.equal(summary.groups[0].assetType, 'RATE');
assert.equal(summary.groups.find((item) => item.assetType === 'STOCK')?.score, 60);
assert.equal(summary.groups.some((item) => item.assetType === 'INDEX'), false);

console.log('market summary tests passed');
