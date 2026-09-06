import { createAsset, listAssets } from '@/db/assets';
import { apiError, json, requireAdmin } from '@/lib/api';
import { parseAssetInput } from '@/lib/asset';

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    return json({ assets: await listAssets() });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    return json({ asset: await createAsset(parseAssetInput(await request.json())) }, 201);
  } catch (error) {
    return apiError(error);
  }
}
