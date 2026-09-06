import { getAsset } from '@/db/assets';
import { listHistory } from '@/db/market-data';
import { apiError, json, pathId } from '@/lib/api';

export async function GET(request: Request) {
  try {
    const id = pathId(request, 1);
    const asset = await getAsset(id);
    if (!asset) return json({ error: '자산을 찾을 수 없습니다.' }, 404);
    const requested = Number(new URL(request.url).searchParams.get('limit') ?? 250);
    const limit = Number.isInteger(requested) ? Math.min(500, Math.max(1, requested)) : 250;
    return json({ asset, history: await listHistory(id, limit) });
  } catch (error) {
    return apiError(error);
  }
}
