import { isProviderDailyLimitError } from './provider-error.ts';

export type ApiErrorCode = 'INVALID_REQUEST' | 'AUTH_REQUIRED' | 'FORBIDDEN' | 'NOT_FOUND'
  | 'CONFLICT' | 'PREREQUISITE_MISSING' | 'CONFIGURATION_REQUIRED'
  | 'PROVIDER_RATE_LIMIT' | 'PROVIDER_ERROR' | 'SERVICE_UNAVAILABLE' | 'INTERNAL_ERROR';

export type ApiFailure = {
  status: number;
  code: ApiErrorCode;
  error: string;
  retryable: boolean;
};

const configuration = /설정되지 않았|Worker Secrets|필요한 공급자 키|API 키가 설정/i;

export function errorMetadata(status: number, message = ''): Pick<ApiFailure, 'code' | 'retryable'> {
  if (status === 503 && configuration.test(message)) return { code: 'CONFIGURATION_REQUIRED', retryable: false };
  if (status === 401) return { code: 'AUTH_REQUIRED', retryable: false };
  if (status === 403) return { code: 'FORBIDDEN', retryable: false };
  if (status === 404) return { code: 'NOT_FOUND', retryable: false };
  if (status === 409) return { code: 'CONFLICT', retryable: false };
  if (status === 429) return { code: 'PROVIDER_RATE_LIMIT', retryable: true };
  if (status === 502) return { code: 'PROVIDER_ERROR', retryable: true };
  if (status === 503) return { code: 'SERVICE_UNAVAILABLE', retryable: true };
  if (status >= 500) return { code: 'INTERNAL_ERROR', retryable: false };
  return { code: 'INVALID_REQUEST', retryable: false };
}

export function withErrorMetadata(data: unknown, status: number): unknown {
  if (status < 400 || !data || typeof data !== 'object' || Array.isArray(data)) return data;
  const value = data as Record<string, unknown>;
  if (typeof value.error !== 'string') return data;
  const metadata = errorMetadata(status, value.error);
  return {
    ...value,
    code: typeof value.code === 'string' ? value.code : metadata.code,
    retryable: typeof value.retryable === 'boolean' ? value.retryable : metadata.retryable,
  };
}

export function classifyApiError(error: unknown): ApiFailure {
  const message = error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
  if (isProviderDailyLimitError(error) || /rate limit|requests per day|call frequency|quota exceeded/i.test(message)) {
    return { status: 429, code: 'PROVIDER_RATE_LIMIT', error: '데이터 공급자 호출 한도에 도달했습니다. 할당량 초기화 후 다시 시도하세요.', retryable: true };
  }
  if (error instanceof SyntaxError) {
    return { status: 400, code: 'INVALID_REQUEST', error: '요청 본문이 올바른 JSON 형식이 아닙니다.', retryable: false };
  }
  if (/UNIQUE constraint failed/i.test(message)) {
    return { status: 409, code: 'CONFLICT', error: '이미 등록된 값입니다.', retryable: false };
  }
  if (configuration.test(message)) {
    return { status: 503, code: 'CONFIGURATION_REQUIRED', error: message, retryable: false };
  }
  if (/먼저 .+하세요|생성할 .+ 없습니다|발송할 .+ 없습니다|조회할 .+ 없습니다|수집 대상 .+ 없습니다/i.test(message)) {
    return { status: 409, code: 'PREREQUISITE_MISSING', error: message, retryable: false };
  }
  if (/fetch failed|network|timed? ?out|timeout|ECONN|ENOTFOUND|EAI_AGAIN|\((?:502|503|504)\)/i.test(message)) {
    return { status: 503, code: 'SERVICE_UNAVAILABLE', error: '일시적인 외부 서비스 장애입니다. 잠시 후 다시 시도하세요.', retryable: true };
  }
  if (/데이터 공급자|공급자 요청|KIS|Yahoo|미 재무부|BLS 캘린더|NAVER 뉴스|뉴스 데이터|일봉 데이터|경제지표 일봉|시세 응답|Telegram 발송|Email 발송|유효한 .+데이터/i.test(message)) {
    return { status: 502, code: 'PROVIDER_ERROR', error: '외부 데이터 공급자 요청에 실패했습니다. 잠시 후 다시 시도하세요.', retryable: true };
  }
  if (/올바르지|필요합니다|입력하세요|확인하세요|지원하지 않는|허용되지 않은|사이여야|이어야|중복되었습니다|최소 \d+/i.test(message)) {
    return { status: 400, code: 'INVALID_REQUEST', error: message, retryable: false };
  }
  return { status: 500, code: 'INTERNAL_ERROR', error: '서버 내부 오류가 발생했습니다.', retryable: false };
}
