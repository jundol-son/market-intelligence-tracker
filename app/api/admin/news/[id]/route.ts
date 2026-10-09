import { env } from 'cloudflare:workers';
import { getAsset } from '@/db/assets';
import { saveNews } from '@/db/news';
import { finishProviderCall, providerUsage, reserveProviderCall } from '@/db/provider-usage';
import { apiError, json, pathId, requireAdmin } from '@/lib/api';
import { naverNewsQueryFor, newsTickerFor } from '@/lib/catalog';
import { AlphaVantageNewsProvider, NaverNewsProvider } from '@/lib/news';

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const asset = await getAsset(pathId(request));
    if (!asset) return json({ error: '자산을 찾을 수 없습니다.' }, 404);
    const query = naverNewsQueryFor(asset.symbol, asset.name);
    const ticker = newsTickerFor(asset.symbol);
    if (!query && !ticker) return json({ error: `${asset.symbol}은 뉴스 공급자와 연결되지 않았습니다.` }, 400);
    const isNaver = Boolean(query);
    if (isNaver && (!env.NAVER_API_HUB_CLIENT_ID || !env.NAVER_API_HUB_CLIENT_SECRET)) {
      return json({ error: 'NAVER 뉴스 인증 정보가 설정되지 않았습니다.' }, 503);
    }
    if (!isNaver && !env.ALPHA_VANTAGE_API_KEY) {
      return json({ error: 'ALPHA_VANTAGE_API_KEY가 설정되지 않았습니다.' }, 503);
    }
    const reservation = await reserveProviderCall(`${isNaver ? 'NAVER_API' : 'ALPHA_API'}:NEWS:${asset.symbol}`, isNaver ? 18 : 24);
    if (!reservation.reserved) {
      return json({ collection: { assetId: asset.id, symbol: asset.symbol, called: false,
        provider: isNaver ? 'NAVER Search' : 'Alpha Vantage', reason: reservation.reason }, quota: await providerUsage() });
    }
    try {
      const articles = isNaver
        ? await new NaverNewsProvider(env.NAVER_API_HUB_CLIENT_ID!, env.NAVER_API_HUB_CLIENT_SECRET!).getNews(query!)
        : await new AlphaVantageNewsProvider(env.ALPHA_VANTAGE_API_KEY!).getNews(ticker!);
      const result = await saveNews(asset.id, articles);
      await finishProviderCall(reservation.id);
      return json({ collection: { assetId: asset.id, symbol: asset.symbol, called: true,
        provider: isNaver ? 'NAVER Search' : 'Alpha Vantage', ...result }, quota: await providerUsage() });
    } catch (error) {
      await finishProviderCall(reservation.id, error);
      throw error;
    }
  } catch (error) {
    return apiError(error);
  }
}
