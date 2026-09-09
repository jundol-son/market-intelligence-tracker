import assert from 'node:assert/strict';
import { secureEqual, secureEqualAny } from './security.ts';

assert.equal(secureEqual('correct horse', 'correct horse'), true);
assert.equal(secureEqual('correct horse', 'correct house'), false);
assert.equal(secureEqual('short', 'longer'), false);
assert.equal(secureEqualAny('legacy-token', ['password', 'legacy-token']), true);
assert.equal(secureEqualAny('wrong', ['password', undefined]), false);
console.log('security checks passed');
