import { env } from 'cloudflare:workers';
import { getAsset } from '@/db/assets';
import { collectAssetPrice, refreshTreasurySpread } from '@/db/collection';
import { providerUsage } from '@/db/provider-usage';
import { apiError, json, pathId, requireAdmin } from '@/lib/api';
import { recalculateScores } from '@/db/scoring';
import { evaluateForecastResults } from '@/db/reports';

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    if (!env.ALPHA_VANTAGE_API_KEY && !(env.KIS_APP_KEY && env.KIS_APP_SECRET)) {
      return json({ error: '가격 공급자 API 키가 설정되지 않았습니다.' }, 503);
    }
    const asset = await getAsset(pathId(request));
    if (!asset) return json({ error: '자산을 찾을 수 없습니다.' }, 404);

    const collection = await collectAssetPrice(asset, {
      alphaVantageApiKey: env.ALPHA_VANTAGE_API_KEY,
      kisAppKey: env.KIS_APP_KEY,
      kisAppSecret: env.KIS_APP_SECRET,
    });
    if (!collection.called) return json({ collection, quota: await providerUsage() });
    await refreshTreasurySpread();
    const scores = await recalculateScores();
    const forecastResults = await evaluateForecastResults();

    return json({
      collection, scores, forecastResults, quota: await providerUsage(),
    });
  } catch (error) {
    return apiError(error);
  }
}
