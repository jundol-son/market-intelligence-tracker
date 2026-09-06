import { env } from 'cloudflare:workers';
import { getAsset } from '@/db/assets';
import { saveNews } from '@/db/news';
import { apiError, json, pathId, requireAdmin } from '@/lib/api';
import { AlphaVantageNewsProvider } from '@/lib/news';

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    if (!env.ALPHA_VANTAGE_API_KEY) {
      return json({ error: 'ALPHA_VANTAGE_API_KEY가 설정되지 않았습니다.' }, 503);
    }
    const asset = await getAsset(pathId(request));
    if (!asset) return json({ error: '자산을 찾을 수 없습니다.' }, 404);
    const result = await saveNews(asset.id,
      await new AlphaVantageNewsProvider(env.ALPHA_VANTAGE_API_KEY).getNews(asset.symbol));
    return json({ collection: { assetId: asset.id, symbol: asset.symbol, ...result } });
  } catch (error) {
    return apiError(error);
  }
}
