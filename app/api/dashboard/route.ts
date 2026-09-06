import { assetCounts } from '@/db/assets';
import { listMarketSnapshots } from '@/db/market-data';
import { apiError, json } from '@/lib/api';

export async function GET() {
  try {
    const [counts, market] = await Promise.all([assetCounts(), listMarketSnapshots()]);
    return json({
      phase: 2,
      assets: { total: counts?.total ?? 0, enabled: counts?.enabled ?? 0 },
      market,
      scores: null,
      message: market.some((item) => item.price !== null)
        ? '가격과 기술지표가 연결됐습니다. 점수는 Phase 3에서 계산합니다.'
        : 'Admin에서 자산별 가격 수집을 실행하세요.',
    });
  } catch (error) {
    return apiError(error);
  }
}
