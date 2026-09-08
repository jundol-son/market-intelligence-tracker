import type { Asset } from './assets';
import { listAssets } from './assets';
import { listPrices, upsertIndicators, upsertPrices } from './market-data';
import { finishProviderCall, reserveProviderCall } from './provider-usage';
import { calculateIndicators } from '@/lib/indicators';
import { isCollectable } from '@/lib/catalog';
import { AlphaVantageProvider, calculateTreasurySpread } from '@/lib/market-data';

export async function collectAssetPrice(asset: Asset, apiKey: string) {
  if (!isCollectable(asset.symbol)) throw new Error(`${asset.symbol}은 아직 자동 수집 대상이 아닙니다.`);
  const reservation = await reserveProviderCall(`ALPHA_API:PRICE:${asset.symbol}`);
  if (!reservation.reserved) return { called: false as const, reason: reservation.reason };
  try {
    const prices = await new AlphaVantageProvider(apiKey).getHistoricalPrices(asset.symbol);
    await upsertPrices(asset.id, prices, 'ALPHA_VANTAGE');
    const stored = await listPrices(asset.id);
    const benchmark = asset.benchmarkAssetId ? await listPrices(asset.benchmarkAssetId) : [];
    await upsertIndicators(asset.id, calculateIndicators(stored, benchmark));
    await finishProviderCall(reservation.id);
    return {
      called: true as const, assetId: asset.id, symbol: asset.symbol,
      prices: prices.length, latestDate: stored.at(-1)?.date ?? null,
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
