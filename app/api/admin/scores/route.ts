import { recalculateScores } from '@/db/scoring';
import { apiError, json, requireAdmin } from '@/lib/api';

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    return json({ recalculated: await recalculateScores() });
  } catch (error) {
    return apiError(error);
  }
}
