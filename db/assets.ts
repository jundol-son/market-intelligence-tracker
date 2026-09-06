import type { AssetInput } from '@/lib/asset';
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
