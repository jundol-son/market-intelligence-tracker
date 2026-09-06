import assert from 'node:assert/strict';
import { evaluateForecast, reportSummary } from './report.ts';

const result = evaluateForecast(100, 101, 60, 40, -0.5, 1.5);
assert.ok(Math.abs(result.actualReturn - 1) < 1e-9);
assert.equal(result.directionHit, true);
assert.equal(result.rangeHit, true);
assert.match(reportSummary('RISK_ON', 68, 2.25), /위험선호.*\+2\.3점/);

console.log('report engine: ok');
