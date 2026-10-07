import { env } from 'cloudflare:workers';
import { listNews } from '@/db/news';
import { apiError, json } from '@/lib/api';

export async function GET(request: Request) {
  try {
    const requested = Number(new URL(request.url).searchParams.get('limit') ?? 50);
    const limit = Number.isInteger(requested) ? Math.min(100, Math.max(1, requested)) : 50;
    return json({ ...await listNews(limit), providers: {
      alphaConfigured: Boolean(env.ALPHA_VANTAGE_API_KEY),
      naverConfigured: Boolean(env.NAVER_API_HUB_CLIENT_ID && env.NAVER_API_HUB_CLIENT_SECRET),
    } });
  } catch (error) {
    return apiError(error);
  }
}
