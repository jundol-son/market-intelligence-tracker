import { env } from 'cloudflare:workers';
import { getAsset } from '@/db/assets';
import { listPrices, upsertIndicators, upsertPrices } from '@/db/market-data';
import { apiError, json, pathId, requireAdmin } from '@/lib/api';
import { calculateIndicators } from '@/lib/indicators';
import { AlphaVantageProvider } from '@/lib/market-data';
import { recalculateScores } from '@/db/scoring';

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    if (!env.ALPHA_VANTAGE_API_KEY) {
      return json({ error: 'ALPHA_VANTAGE_API_KEY가 설정되지 않았습니다.' }, 503);
    }
    const asset = await getAsset(pathId(request));
    if (!asset) return json({ error: '자산을 찾을 수 없습니다.' }, 404);

    const prices = await new AlphaVantageProvider(env.ALPHA_VANTAGE_API_KEY)
      .getHistoricalPrices(asset.symbol);
    await upsertPrices(asset.id, prices, 'ALPHA_VANTAGE');
    const stored = await listPrices(asset.id);
    const benchmark = asset.benchmarkAssetId ? await listPrices(asset.benchmarkAssetId) : [];
    const indicators = calculateIndicators(stored, benchmark);
    await upsertIndicators(asset.id, indicators);
    const scores = await recalculateScores();

    return json({
      collection: {
        assetId: asset.id, symbol: asset.symbol, prices: prices.length,
        latestDate: stored.at(-1)?.date ?? null,
      }, scores,
    });
  } catch (error) {
    return apiError(error);
  }
}
