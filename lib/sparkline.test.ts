import assert from 'node:assert/strict';
import { sparklinePoints } from './sparkline.ts';

assert.equal(sparklinePoints([10, 20, 15], 100, 40), '0,40 50,0 100,20');
assert.equal(sparklinePoints([]), '');
assert.equal(sparklinePoints([5, 5], 10, 10), '0,10 10,10');
assert.equal(sparklinePoints([5], 10, 10), '5,10');
console.log('sparkline checks passed');
