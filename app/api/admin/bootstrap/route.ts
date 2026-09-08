import { seedDefaultAssets } from '@/db/assets';
import { apiError, json, requireAdmin } from '@/lib/api';

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const result = await seedDefaultAssets();
    return json({ bootstrap: { created: result.created, total: result.assets.length }, assets: result.assets });
  } catch (error) {
    return apiError(error);
  }
}
