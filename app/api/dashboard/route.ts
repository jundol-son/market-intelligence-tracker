import { assetCounts } from '@/db/assets';
import { listMarketSnapshots } from '@/db/market-data';
import { getLatestMarketScore } from '@/db/scoring';
import { getKisDashboard } from '@/db/kis-insights';
import { apiError, json } from '@/lib/api';

export async function GET() {
  try {
    const [counts, market, scores, kis] = await Promise.all([assetCounts(), listMarketSnapshots(), getLatestMarketScore(), getKisDashboard()]);
    return json({
      phase: 12,
      assets: { total: counts?.total ?? 0, enabled: counts?.enabled ?? 0 },
      market,
      scores,
      kis,
      message: market.some((item) => item.price !== null)
        ? '가격·기술지표·점수가 연결됐습니다. 뉴스는 별도 News Score로 추적합니다.'
        : 'Admin에서 자산별 가격 수집을 실행하세요.',
    });
  } catch (error) {
    return apiError(error);
  }
}
