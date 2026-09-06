import { listAssets } from '@/db/assets';
import { apiError, json } from '@/lib/api';

export async function GET() {
  try {
    return json({ assets: await listAssets() });
  } catch (error) {
    return apiError(error);
  }
}
