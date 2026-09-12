import type { AssetInput } from '@/lib/asset';
import { DEFAULT_ASSETS } from '@/lib/catalog';
import { getDb } from './index';

export type Asset = AssetInput & {
  id: number;
  createdAt: string;
  updatedAt: string;
};

const SELECT = `SELECT id, symbol, name, asset_type AS assetType, market, currency,
  benchmark_asset_id AS benchmarkAssetId, group_id AS groupId, enabled,
  importance_weight AS importanceWeight, created_at AS createdAt, updated_at AS updatedAt
  FROM assets`;

export async function listAssets(): Promise<Asset[]> {
  const result = await getDb().prepare(`${SELECT} ORDER BY symbol`).all<Asset>();
  return result.results.map((asset) => ({ ...asset, enabled: Boolean(asset.enabled) }));
}

export async function listAssetsForCollection(): Promise<Array<Asset & { lastAttemptAt: string | null }>> {
  const result = await getDb().prepare(`SELECT id, symbol, name, asset_type AS assetType, market, currency,
    benchmark_asset_id AS benchmarkAssetId, group_id AS groupId, enabled,
    importance_weight AS importanceWeight, created_at AS createdAt, updated_at AS updatedAt,
    (SELECT MAX(j.started_at) FROM job_runs j
      WHERE j.job_name IN ('ALPHA_API:PRICE:' || assets.symbol, 'KIS_API:PRICE:' || assets.symbol,
        'FRED_API:PRICE:' || assets.symbol)) AS lastAttemptAt
    FROM assets ORDER BY lastAttemptAt IS NOT NULL, datetime(lastAttemptAt), importance_weight DESC, symbol`)
    .all<Asset & { lastAttemptAt: string | null }>();
  return result.results.map((asset) => ({ ...asset, enabled: Boolean(asset.enabled) }));
}

export async function getAsset(id: number): Promise<Asset | null> {
  const asset = await getDb().prepare(`${SELECT} WHERE id = ?`).bind(id).first<Asset>();
  return asset ? { ...asset, enabled: Boolean(asset.enabled) } : null;
}

export async function createAsset(input: AssetInput): Promise<Asset> {
  const asset = await getDb().prepare(`INSERT INTO assets
    (symbol, name, asset_type, market, currency, benchmark_asset_id, group_id, enabled, importance_weight)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id, symbol, name, asset_type AS assetType, market, currency,
      benchmark_asset_id AS benchmarkAssetId, group_id AS groupId, enabled,
      importance_weight AS importanceWeight, created_at AS createdAt, updated_at AS updatedAt`)
    .bind(input.symbol, input.name, input.assetType, input.market, input.currency,
      input.benchmarkAssetId, input.groupId, input.enabled ? 1 : 0, input.importanceWeight)
    .first<Asset>();
  if (!asset) throw new Error('자산을 저장하지 못했습니다.');
  return { ...asset, enabled: Boolean(asset.enabled) };
}

export async function seedDefaultAssets() {
  const db = getDb();
  const before = await db.prepare('SELECT COUNT(*) AS count FROM assets').first<{ count: number }>();
  await db.batch(DEFAULT_ASSETS.map((input) => db.prepare(`INSERT OR IGNORE INTO assets
    (symbol, name, asset_type, market, currency, benchmark_asset_id, group_id, enabled, importance_weight)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    input.symbol, input.name, input.assetType, input.market, input.currency,
    input.benchmarkAssetId, input.groupId, input.enabled ? 1 : 0, input.importanceWeight,
  )));
  await db.prepare(`UPDATE assets SET name=CASE symbol WHEN 'KOSPI' THEN 'KOSPI' ELSE 'KOSDAQ' END,
    market=symbol, currency='KRW', enabled=1, updated_at=CURRENT_TIMESTAMP
    WHERE symbol IN ('KOSPI', 'KOSDAQ')`).run();
  const assets = await listAssets();
  return { created: assets.length - (before?.count ?? 0), assets };
}

export async function updateAsset(id: number, input: AssetInput): Promise<Asset | null> {
  const asset = await getDb().prepare(`UPDATE assets SET
    symbol = ?, name = ?, asset_type = ?, market = ?, currency = ?, benchmark_asset_id = ?,
    group_id = ?, enabled = ?, importance_weight = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    RETURNING id, symbol, name, asset_type AS assetType, market, currency,
      benchmark_asset_id AS benchmarkAssetId, group_id AS groupId, enabled,
      importance_weight AS importanceWeight, created_at AS createdAt, updated_at AS updatedAt`)
    .bind(input.symbol, input.name, input.assetType, input.market, input.currency,
      input.benchmarkAssetId, input.groupId, input.enabled ? 1 : 0, input.importanceWeight, id)
    .first<Asset>();
  return asset ? { ...asset, enabled: Boolean(asset.enabled) } : null;
}

export async function deleteAsset(id: number): Promise<boolean> {
  const result = await getDb().prepare('DELETE FROM assets WHERE id = ?').bind(id).run();
  return result.meta.changes > 0;
}

export async function assetCounts() {
  return getDb().prepare(`SELECT COUNT(*) AS total,
    SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS enabled FROM assets`).first<{ total: number; enabled: number | null }>();
}
