import type { IndicatorPoint } from '@/lib/indicators';
import type { PriceBar } from '@/lib/market-data';
import { getDb } from './index';

export type MarketSnapshot = {
  id: number;
  symbol: string;
  name: string;
  date: string | null;
  price: number | null;
  return1d: number | null;
  ma20: number | null;
  ma60: number | null;
  rsi14: number | null;
  atr14: number | null;
  relativeStrength: number | null;
};

export async function upsertPrices(assetId: number, prices: PriceBar[], source: string): Promise<void> {
  if (!prices.length) return;
  await getDb().batch(prices.map((price) => getDb().prepare(`INSERT INTO asset_prices
    (asset_id, date, open, high, low, close, volume, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(asset_id, date) DO UPDATE SET open=excluded.open, high=excluded.high,
      low=excluded.low, close=excluded.close, volume=excluded.volume, source=excluded.source`)
    .bind(assetId, price.date, price.open, price.high, price.low, price.close, price.volume, source)));
}

export async function listPrices(assetId: number, limit = 250): Promise<PriceBar[]> {
  const result = await getDb().prepare(`SELECT date, open, high, low, close, volume
    FROM asset_prices WHERE asset_id = ? ORDER BY date DESC LIMIT ?`).bind(assetId, limit).all<PriceBar>();
  return result.results.reverse();
}

export async function upsertIndicators(assetId: number, rows: IndicatorPoint[]): Promise<void> {
  if (!rows.length) return;
  await getDb().batch(rows.map((row) => getDb().prepare(`INSERT INTO asset_indicators
    (asset_id, date, ma5, ma20, ma60, ma120, ma200, ma20_distance, ma60_distance,
      ma120_distance, ma200_distance, ma20_slope, ma60_slope, rsi14, atr14,
      return_1d, return_5d, return_20d, return_60d, volume_ratio, relative_strength)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(asset_id, date) DO UPDATE SET ma5=excluded.ma5, ma20=excluded.ma20,
      ma60=excluded.ma60, ma120=excluded.ma120, ma200=excluded.ma200,
      ma20_distance=excluded.ma20_distance, ma60_distance=excluded.ma60_distance,
      ma120_distance=excluded.ma120_distance, ma200_distance=excluded.ma200_distance,
      ma20_slope=excluded.ma20_slope, ma60_slope=excluded.ma60_slope,
      rsi14=excluded.rsi14, atr14=excluded.atr14, return_1d=excluded.return_1d,
      return_5d=excluded.return_5d, return_20d=excluded.return_20d,
      return_60d=excluded.return_60d, volume_ratio=excluded.volume_ratio,
      relative_strength=excluded.relative_strength`)
    .bind(assetId, row.date, row.ma5, row.ma20, row.ma60, row.ma120, row.ma200,
      row.ma20Distance, row.ma60Distance, row.ma120Distance, row.ma200Distance,
      row.ma20Slope, row.ma60Slope, row.rsi14, row.atr14, row.return1d, row.return5d,
      row.return20d, row.return60d, row.volumeRatio, row.relativeStrength)));
}

export async function listHistory(assetId: number, limit = 250) {
  const result = await getDb().prepare(`SELECT p.date, p.open, p.high, p.low, p.close, p.volume, p.source,
    i.ma5, i.ma20, i.ma60, i.ma120, i.ma200, i.ma20_distance AS ma20Distance,
    i.ma60_distance AS ma60Distance, i.ma120_distance AS ma120Distance,
    i.ma200_distance AS ma200Distance, i.ma20_slope AS ma20Slope,
    i.ma60_slope AS ma60Slope, i.rsi14, i.atr14, i.return_1d AS return1d,
    i.return_5d AS return5d, i.return_20d AS return20d, i.return_60d AS return60d,
    i.volume_ratio AS volumeRatio, i.relative_strength AS relativeStrength
    FROM asset_prices p LEFT JOIN asset_indicators i ON i.asset_id=p.asset_id AND i.date=p.date
    WHERE p.asset_id=? ORDER BY p.date DESC LIMIT ?`).bind(assetId, limit).all();
  return result.results;
}

export async function listMarketSnapshots(): Promise<MarketSnapshot[]> {
  const result = await getDb().prepare(`SELECT a.id, a.symbol, a.name, p.date, p.close AS price,
    i.return_1d AS return1d, i.ma20, i.ma60, i.rsi14, i.atr14,
    i.relative_strength AS relativeStrength
    FROM assets a
    LEFT JOIN asset_prices p ON p.id=(SELECT p2.id FROM asset_prices p2
      WHERE p2.asset_id=a.id ORDER BY p2.date DESC LIMIT 1)
    LEFT JOIN asset_indicators i ON i.asset_id=a.id AND i.date=p.date
    WHERE a.enabled=1 ORDER BY a.importance_weight DESC, a.symbol`).all<MarketSnapshot>();
  return result.results;
}
