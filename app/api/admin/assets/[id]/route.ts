import { deleteAsset, updateAsset } from '@/db/assets';
import { apiError, json, pathId, requireAdmin } from '@/lib/api';
import { parseAssetInput } from '@/lib/asset';

export async function PUT(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const asset = await updateAsset(pathId(request), parseAssetInput(await request.json()));
    return asset ? json({ asset }) : json({ error: '자산을 찾을 수 없습니다.' }, 404);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    return (await deleteAsset(pathId(request)))
      ? json({ deleted: true })
      : json({ error: '자산을 찾을 수 없습니다.' }, 404);
  } catch (error) {
    return apiError(error);
  }
}
