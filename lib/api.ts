import { env } from 'cloudflare:workers';
import { secureEqual } from '@/lib/security';

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function requireAdmin(request: Request): Response | null {
  const password = env.ADMIN_PASSWORD ?? env.ADMIN_TOKEN;
  if (!password) return json({ error: 'ADMIN_PASSWORD가 설정되지 않았습니다.' }, 503);
  const provided = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  if (!secureEqual(provided, password)) {
    return json({ error: '관리자 인증이 필요합니다.' }, 401);
  }
  return null;
}

export function apiError(error: unknown): Response {
  const message = error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
  return json({ error: message }, /UNIQUE constraint failed/i.test(message) ? 409 : 400);
}

export function pathId(request: Request, offset = 0): number {
  const parts = new URL(request.url).pathname.split('/').filter(Boolean);
  const id = Number(parts.at(-1 - offset));
  if (!Number.isInteger(id) || id < 1) throw new Error('ID가 올바르지 않습니다.');
  return id;
}
