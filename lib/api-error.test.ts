import assert from 'node:assert/strict';
import { classifyApiError, errorMetadata, withErrorMetadata } from './api-error.ts';
import { PROVIDER_DAILY_LIMIT_MESSAGE } from './provider-error.ts';

assert.deepEqual(classifyApiError(new SyntaxError('Unexpected token')), {
  status: 400, code: 'INVALID_REQUEST', error: '요청 본문이 올바른 JSON 형식이 아닙니다.', retryable: false,
});
assert.equal(classifyApiError(new Error('UNIQUE constraint failed: assets.symbol')).status, 409);
assert.equal(classifyApiError(new Error(PROVIDER_DAILY_LIMIT_MESSAGE)).status, 429);
assert.equal(classifyApiError(new Error('KIS 시세 조회 실패 (503)')).code, 'SERVICE_UNAVAILABLE');
assert.equal(classifyApiError(new Error('NAVER 뉴스 공급자 요청 실패 (401)')).code, 'PROVIDER_ERROR');
assert.equal(classifyApiError(new Error('이름은 1~80자로 입력하세요.')).status, 400);
assert.deepEqual(classifyApiError(new Error('D1_ERROR: secret detail')), {
  status: 500, code: 'INTERNAL_ERROR', error: '서버 내부 오류가 발생했습니다.', retryable: false,
});
assert.deepEqual(errorMetadata(503, 'ADMIN_PASSWORD가 설정되지 않았습니다.'), {
  code: 'CONFIGURATION_REQUIRED', retryable: false,
});
assert.deepEqual(errorMetadata(404), { code: 'NOT_FOUND', retryable: false });
assert.deepEqual(withErrorMetadata({ error: '자산을 찾을 수 없습니다.' }, 404), {
  error: '자산을 찾을 수 없습니다.', code: 'NOT_FOUND', retryable: false,
});
assert.deepEqual(withErrorMetadata({ error: 'ADMIN_PASSWORD가 설정되지 않았습니다.' }, 503), {
  error: 'ADMIN_PASSWORD가 설정되지 않았습니다.', code: 'CONFIGURATION_REQUIRED', retryable: false,
});
assert.deepEqual(withErrorMetadata({ status: 'degraded' }, 503), { status: 'degraded' });

console.log('api error classification: ok');
