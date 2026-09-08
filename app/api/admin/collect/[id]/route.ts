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
    if (!env.ALPHA_VANTAGE_API_KEY) {
      return json({ error: 'ALPHA_VANTAGE_API_KEY가 설정되지 않았습니다.' }, 503);
    }
    const asset = await getAsset(pathId(request));
    if (!asset) return json({ error: '자산을 찾을 수 없습니다.' }, 404);

    const collection = await collectAssetPrice(asset, env.ALPHA_VANTAGE_API_KEY);
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
