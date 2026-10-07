import { env } from 'cloudflare:workers';
import { classifyApiError, withErrorMetadata } from '@/lib/api-error';
import { secureEqualAny } from '@/lib/security';

export function json(data: unknown, status = 200): Response {
  return Response.json(withErrorMetadata(data, status), { status, headers: { 'Cache-Control': 'no-store' } });
}

export function requireAdmin(request: Request): Response | null {
  if (!env.ADMIN_PASSWORD && !env.ADMIN_TOKEN) return json({ error: 'ADMIN_PASSWORD가 설정되지 않았습니다.' }, 503);
  const provided = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  if (!secureEqualAny(provided, [env.ADMIN_PASSWORD, env.ADMIN_TOKEN])) {
    return json({ error: '관리자 인증이 필요합니다.' }, 401);
  }
  return null;
}

export function apiError(error: unknown): Response {
  const failure = classifyApiError(error);
  if (failure.status >= 500) console.error(`[API ${failure.code}]`, error);
  return json({ error: failure.error, code: failure.code, retryable: failure.retryable }, failure.status);
}

export function pathId(request: Request, offset = 0): number {
  const parts = new URL(request.url).pathname.split('/').filter(Boolean);
  const id = Number(parts.at(-1 - offset));
  if (!Number.isInteger(id) || id < 1) throw new Error('ID가 올바르지 않습니다.');
  return id;
}
