import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const assets = sqliteTable('assets', {
  id: integer().primaryKey({ autoIncrement: true }),
  symbol: text().notNull().unique(),
  name: text().notNull(),
  assetType: text('asset_type').notNull(),
  market: text().notNull(),
  currency: text().notNull(),
  benchmarkAssetId: integer('benchmark_asset_id'),
  groupId: integer('group_id'),
  enabled: integer({ mode: 'boolean' }).notNull().default(true),
  importanceWeight: real('importance_weight').notNull().default(1),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const assetPrices = sqliteTable('asset_prices', {
  id: integer().primaryKey({ autoIncrement: true }),
  assetId: integer('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  date: text().notNull(),
  open: real().notNull(),
  high: real().notNull(),
  low: real().notNull(),
  close: real().notNull(),
  volume: real().notNull(),
  source: text().notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('asset_prices_asset_date_unique').on(table.assetId, table.date)]);

export const assetIndicators = sqliteTable('asset_indicators', {
  id: integer().primaryKey({ autoIncrement: true }),
  assetId: integer('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  date: text().notNull(),
  ma5: real(),
  ma20: real(),
  ma60: real(),
  ma120: real(),
  ma200: real(),
  ma20Distance: real('ma20_distance'),
  ma60Distance: real('ma60_distance'),
  ma120Distance: real('ma120_distance'),
  ma200Distance: real('ma200_distance'),
  ma20Slope: real('ma20_slope'),
  ma60Slope: real('ma60_slope'),
  rsi14: real(),
  atr14: real(),
  return1d: real('return_1d'),
  return5d: real('return_5d'),
  return20d: real('return_20d'),
  return60d: real('return_60d'),
  volumeRatio: real('volume_ratio'),
  relativeStrength: real('relative_strength'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('asset_indicators_asset_date_unique').on(table.assetId, table.date)]);
