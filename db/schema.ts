import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
