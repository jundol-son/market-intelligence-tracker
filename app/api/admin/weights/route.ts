import { getWeights, recalculateScores, saveWeights } from '@/db/scoring';
import { apiError, json, requireAdmin } from '@/lib/api';
import { parseWeights } from '@/lib/scoring';

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    return json({ weights: await getWeights() });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const weights = parseWeights(await request.json());
    await saveWeights(weights);
    return json({ weights, recalculated: await recalculateScores() });
  } catch (error) {
    return apiError(error);
  }
}
