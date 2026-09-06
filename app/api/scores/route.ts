import { listScoreHistory } from '@/db/scoring';
import { apiError, json } from '@/lib/api';

export async function GET(request: Request) {
  try {
    const requested = Number(new URL(request.url).searchParams.get('limit') ?? 30);
    const limit = Number.isInteger(requested) ? Math.min(365, Math.max(1, requested)) : 30;
    return json(await listScoreHistory(limit));
  } catch (error) {
    return apiError(error);
  }
}
