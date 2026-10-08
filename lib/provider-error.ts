export const PROVIDER_DAILY_LIMIT_MESSAGE = '데이터 공급자의 무료 일일 호출 한도를 초과했습니다. 다음 할당량 초기화 후 다시 시도하세요.';
export const PROVIDER_PREMIUM_MESSAGE = 'Alpha Vantage 뉴스는 현재 무료 플랜에서 제공되지 않습니다. NAVER 뉴스 인증 정보를 설정하세요.';

export function isProviderDailyLimitError(error: unknown) {
  return error instanceof Error && error.message === PROVIDER_DAILY_LIMIT_MESSAGE;
}

export function providerError(body: Record<string, unknown>): string | null {
  const raw = body['Error Message'] ?? body.Note ?? body.Information;
  if (typeof raw !== 'string') return null;
  if (/rate limit|requests per day|call frequency/i.test(raw)) {
    return PROVIDER_DAILY_LIMIT_MESSAGE;
  }
  if (/premium/i.test(raw)) return PROVIDER_PREMIUM_MESSAGE;
  return '데이터 공급자가 요청을 거부했습니다. 심볼과 공급자 설정을 확인하세요.';
}
