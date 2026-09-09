import { env } from 'cloudflare:workers';
import { listAssetsForCollection } from '@/db/assets';
import { canCollectWith, collectAssetPrice, refreshTreasurySpread } from '@/db/collection';
import { providerUsage } from '@/db/provider-usage';
import { evaluateForecastResults } from '@/db/reports';
import { recalculateScores } from '@/db/scoring';
import { apiError, json, requireAdmin } from '@/lib/api';
import { isCollectable } from '@/lib/catalog';
import { isProviderDailyLimitError } from '@/lib/provider-error';

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const credentials = {
      alphaVantageApiKey: env.ALPHA_VANTAGE_API_KEY,
      kisAppKey: env.KIS_APP_KEY,
      kisAppSecret: env.KIS_APP_SECRET,
    };
    if (!credentials.alphaVantageApiKey && !(credentials.kisAppKey && credentials.kisAppSecret)) {
      return json({ error: '가격 공급자 API 키가 설정되지 않았습니다.' }, 503);
    }
    const raw = await request.json().catch(() => ({})) as { maxCalls?: unknown };
    const requested = Number(raw.maxCalls ?? 5);
    if (!Number.isInteger(requested) || requested < 1 || requested > 10) {
      return json({ error: '한 번에 수집할 호출 수는 1~10이어야 합니다.' }, 400);
    }
    const candidates = (await listAssetsForCollection())
      .filter((asset) => asset.enabled && isCollectable(asset.symbol) && canCollectWith(asset.symbol, credentials));
    const collections = [] as Array<Awaited<ReturnType<typeof collectAssetPrice>> | {
      called: true; assetId: number; symbol: string; prices: 0; latestDate: null; error: string;
    }>;
    let calls = 0;
    let failures = 0;
    for (const asset of candidates) {
      if (calls >= requested) break;
      try {
        const result = await collectAssetPrice(asset, credentials);
        collections.push(result);
        if (result.called) calls += 1;
      } catch (error) {
        calls += 1;
        failures += 1;
        const message = error instanceof Error ? error.message : '수집 실패';
        collections.push({ called: true, assetId: asset.id, symbol: asset.symbol, prices: 0, latestDate: null,
          error: message });
        if (isProviderDailyLimitError(error) || failures >= 2) break;
      }
    }
    const successful = collections.filter((item) => item.called && 'prices' in item && item.prices > 0).length;
    if (successful) {
      await refreshTreasurySpread();
      await recalculateScores();
      await evaluateForecastResults();
    }
    return json({ batch: { requested, calls, successful, collections }, quota: await providerUsage() });
  } catch (error) {
    return apiError(error);
  }
}
