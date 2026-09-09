import type { Asset } from './assets';
import { listAssets } from './assets';
import { listPrices, upsertIndicators, upsertPrices } from './market-data';
import { finishProviderCall, reserveProviderCall } from './provider-usage';
import { calculateIndicators } from '@/lib/indicators';
import { alphaSourceFor, isCollectable, kisSourceFor } from '@/lib/catalog';
import { AlphaVantageProvider, calculateTreasurySpread, KisReadOnlyProvider } from '@/lib/market-data';

export type ProviderCredentials = { alphaVantageApiKey?: string; kisAppKey?: string; kisAppSecret?: string };

export function canCollectWith(symbol: string, credentials: ProviderCredentials): boolean {
  if (kisSourceFor(symbol) && credentials.kisAppKey && credentials.kisAppSecret) return true;
  const kind = alphaSourceFor(symbol).kind;
  return Boolean(credentials.alphaVantageApiKey) && kind !== 'DERIVED' && kind !== 'UNAVAILABLE';
}

export async function collectAssetPrice(asset: Asset, credentials: ProviderCredentials) {
  if (!isCollectable(asset.symbol)) throw new Error(`${asset.symbol}은 아직 자동 수집 대상이 아닙니다.`);
  if (!canCollectWith(asset.symbol, credentials)) throw new Error(`${asset.symbol} 수집에 필요한 공급자 키가 설정되지 않았습니다.`);
  const kisSource = kisSourceFor(asset.symbol);
  const useKis = Boolean(kisSource && credentials.kisAppKey && credentials.kisAppSecret);
  const provider = useKis
    ? new KisReadOnlyProvider(credentials.kisAppKey!, credentials.kisAppSecret!, kisSource!)
    : new AlphaVantageProvider(credentials.alphaVantageApiKey!);
  const providerName = useKis ? 'KIS' : 'ALPHA_VANTAGE';
  const reservation = await reserveProviderCall(`${useKis ? 'KIS_API' : 'ALPHA_API'}:PRICE:${asset.symbol}`);
  if (!reservation.reserved) return { called: false as const, reason: reservation.reason };
  try {
    const prices = await provider.getHistoricalPrices(asset.symbol);
    await upsertPrices(asset.id, prices, providerName);
    const stored = await listPrices(asset.id);
    const benchmark = asset.benchmarkAssetId ? await listPrices(asset.benchmarkAssetId) : [];
    await upsertIndicators(asset.id, calculateIndicators(stored, benchmark));
    await finishProviderCall(reservation.id);
    return {
      called: true as const, assetId: asset.id, symbol: asset.symbol,
      prices: prices.length, latestDate: stored.at(-1)?.date ?? null, provider: providerName,
    };
  } catch (error) {
    await finishProviderCall(reservation.id, error);
    throw error;
  }
}

export async function refreshTreasurySpread() {
  const assets = await listAssets();
  const spread = assets.find((item) => item.symbol === 'US10Y2Y');
  const twoYear = assets.find((item) => item.symbol === 'US2Y');
  const tenYear = assets.find((item) => item.symbol === 'US10Y');
  if (!spread || !twoYear || !tenYear) return 0;
  const [twoPrices, tenPrices] = await Promise.all([listPrices(twoYear.id), listPrices(tenYear.id)]);
  const prices = calculateTreasurySpread(twoPrices, tenPrices);
  await upsertPrices(spread.id, prices, 'CALCULATED:US10Y-US2Y');
  await upsertIndicators(spread.id, calculateIndicators(await listPrices(spread.id)));
  return prices.length;
}
