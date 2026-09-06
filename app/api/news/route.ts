import { listNews } from '@/db/news';
import { apiError, json } from '@/lib/api';

export async function GET(request: Request) {
  try {
    const requested = Number(new URL(request.url).searchParams.get('limit') ?? 50);
    const limit = Number.isInteger(requested) ? Math.min(100, Math.max(1, requested)) : 50;
    return json(await listNews(limit));
  } catch (error) {
    return apiError(error);
  }
}
