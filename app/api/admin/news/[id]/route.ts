import { env } from 'cloudflare:workers';
import { getAsset } from '@/db/assets';
import { saveNews } from '@/db/news';
import { finishProviderCall, providerUsage, reserveProviderCall } from '@/db/provider-usage';
import { apiError, json, pathId, requireAdmin } from '@/lib/api';
import { newsTickerFor } from '@/lib/catalog';
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
    const ticker = newsTickerFor(asset.symbol);
    if (!ticker) return json({ error: `${asset.symbol}은 뉴스 공급자 심볼이 연결되지 않았습니다.` }, 400);
    const reservation = await reserveProviderCall(`ALPHA_API:NEWS:${asset.symbol}`, 24);
    if (!reservation.reserved) {
      return json({ collection: { assetId: asset.id, symbol: asset.symbol, called: false, reason: reservation.reason }, quota: await providerUsage() });
    }
    try {
      const result = await saveNews(asset.id,
        await new AlphaVantageNewsProvider(env.ALPHA_VANTAGE_API_KEY).getNews(ticker));
      await finishProviderCall(reservation.id);
      return json({ collection: { assetId: asset.id, symbol: asset.symbol, called: true, ...result }, quota: await providerUsage() });
    } catch (error) {
      await finishProviderCall(reservation.id, error);
      throw error;
    }
  } catch (error) {
    return apiError(error);
  }
}
