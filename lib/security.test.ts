import assert from 'node:assert/strict';
import { secureEqual } from './security.ts';

assert.equal(secureEqual('correct horse', 'correct horse'), true);
assert.equal(secureEqual('correct horse', 'correct house'), false);
assert.equal(secureEqual('short', 'longer'), false);
console.log('security checks passed');
