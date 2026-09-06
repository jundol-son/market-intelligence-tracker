import { assetCounts } from '@/db/assets';
import { apiError, json } from '@/lib/api';

export async function GET() {
  try {
    const counts = await assetCounts();
    return json({
      phase: 1,
      assets: { total: counts?.total ?? 0, enabled: counts?.enabled ?? 0 },
      scores: null,
      message: '시장 데이터와 점수는 Phase 2~3에서 연결됩니다.',
    });
  } catch (error) {
    return apiError(error);
  }
}
