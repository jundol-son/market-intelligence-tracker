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

export const assetScores = sqliteTable('asset_scores', {
  id: integer().primaryKey({ autoIncrement: true }),
  assetId: integer('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  date: text().notNull(),
  trendScore: real('trend_score'),
  momentumScore: real('momentum_score'),
  riskScore: real('risk_score'),
  technicalScore: real('technical_score'),
  flowScore: real('flow_score'),
  newsScore: real('news_score'),
  relativeScore: real('relative_score'),
  compositeScore: real('composite_score').notNull(),
  scoreChange1d: real('score_change_1d'),
  scoreChange5d: real('score_change_5d'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('asset_scores_asset_date_unique').on(table.assetId, table.date)]);

export const marketScores = sqliteTable('market_scores', {
  id: integer().primaryKey({ autoIncrement: true }),
  date: text().notNull().unique(),
  overallScore: real('overall_score').notNull(),
  globalScore: real('global_score'),
  koreaScore: real('korea_score'),
  overallChange: real('overall_change'),
  globalChange: real('global_change'),
  koreaChange: real('korea_change'),
  marketRegime: text('market_regime').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const scoreWeights = sqliteTable('score_weights', {
  id: integer().primaryKey({ autoIncrement: true }),
  scoreGroup: text('score_group').notNull(),
  metricKey: text('metric_key').notNull(),
  weight: real().notNull(),
  enabled: integer({ mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('score_weights_group_metric_unique').on(table.scoreGroup, table.metricKey)]);

export const reports = sqliteTable('reports', {
  id: integer().primaryKey({ autoIncrement: true }),
  reportDate: text('report_date').notNull(),
  reportType: text('report_type').notNull().default('DAILY'),
  overallScore: real('overall_score').notNull(),
  globalScore: real('global_score'),
  koreaScore: real('korea_score'),
  marketRegime: text('market_regime').notNull(),
  summary: text().notNull(),
  upProbability: real('up_probability'),
  downProbability: real('down_probability'),
  expectedLow: real('expected_low'),
  expectedHigh: real('expected_high'),
  bullProbability: real('bull_probability'),
  baseProbability: real('base_probability'),
  bearProbability: real('bear_probability'),
  confidence: real(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('reports_date_type_unique').on(table.reportDate, table.reportType)]);

export const reportMetrics = sqliteTable('report_metrics', {
  id: integer().primaryKey({ autoIncrement: true }),
  reportId: integer('report_id').notNull().references(() => reports.id, { onDelete: 'cascade' }),
  assetId: integer('asset_id').notNull(),
  symbol: text().notNull(),
  name: text().notNull(),
  price: real(),
  dailyReturn: real('daily_return'),
  ma20: real(),
  ma60: real(),
  ma120: real(),
  ma200: real(),
  ma20Distance: real('ma20_distance'),
  ma60Distance: real('ma60_distance'),
  ma120Distance: real('ma120_distance'),
  ma200Distance: real('ma200_distance'),
  rsi: real(),
  trendScore: real('trend_score'),
  momentumScore: real('momentum_score'),
  riskScore: real('risk_score'),
  newsScore: real('news_score'),
  compositeScore: real('composite_score'),
  scoreChange: real('score_change'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('report_metrics_report_asset_unique').on(table.reportId, table.assetId)]);

export const forecasts = sqliteTable('forecasts', {
  id: integer().primaryKey({ autoIncrement: true }),
  reportId: integer('report_id').notNull().references(() => reports.id, { onDelete: 'cascade' }),
  targetAssetId: integer('target_asset_id').notNull(),
  upProbability: real('up_probability').notNull(),
  downProbability: real('down_probability').notNull(),
  expectedLow: real('expected_low').notNull(),
  expectedHigh: real('expected_high').notNull(),
  bullProbability: real('bull_probability').notNull(),
  baseProbability: real('base_probability').notNull(),
  bearProbability: real('bear_probability').notNull(),
  confidence: real().notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('forecasts_report_asset_unique').on(table.reportId, table.targetAssetId)]);

export const forecastResults = sqliteTable('forecast_results', {
  id: integer().primaryKey({ autoIncrement: true }),
  forecastId: integer('forecast_id').notNull().references(() => forecasts.id, { onDelete: 'cascade' }),
  actualReturn: real('actual_return').notNull(),
  directionHit: integer('direction_hit', { mode: 'boolean' }).notNull(),
  rangeHit: integer('range_hit', { mode: 'boolean' }).notNull(),
  evaluatedAt: text('evaluated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('forecast_results_forecast_unique').on(table.forecastId)]);

export const similarDays = sqliteTable('similar_days', {
  id: integer().primaryKey({ autoIncrement: true }),
  reportId: integer('report_id').notNull().references(() => reports.id, { onDelete: 'cascade' }),
  targetAssetId: integer('target_asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  historicalDate: text('historical_date').notNull(),
  similarityScore: real('similarity_score').notNull(),
  nextDayReturn: real('next_day_return').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('similar_days_report_asset_date_unique')
  .on(table.reportId, table.targetAssetId, table.historicalDate)]);

export const newsEvents = sqliteTable('news_events', {
  id: integer().primaryKey({ autoIncrement: true }),
  fingerprint: text().notNull().unique(),
  title: text().notNull(),
  summary: text().notNull(),
  category: text().notNull(),
  eventTime: text('event_time').notNull(),
  sentiment: text().notNull(),
  sentimentScore: real('sentiment_score').notNull(),
  impactScore: real('impact_score').notNull(),
  confidenceScore: real('confidence_score').notNull(),
  durationType: text('duration_type').notNull(),
  affectedGroups: text('affected_groups').notNull().default('[]'),
  isDuplicateGroup: integer('is_duplicate_group', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const newsSources = sqliteTable('news_sources', {
  id: integer().primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => newsEvents.id, { onDelete: 'cascade' }),
  source: text().notNull(),
  sourceUrl: text('source_url').notNull(),
  sourceRank: integer('source_rank').notNull(),
  publishedAt: text('published_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('news_sources_url_unique').on(table.sourceUrl)]);

export const newsEventAssets = sqliteTable('news_event_assets', {
  id: integer().primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => newsEvents.id, { onDelete: 'cascade' }),
  assetId: integer('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  relevanceScore: real('relevance_score').notNull(),
  sentimentScore: real('sentiment_score').notNull(),
}, (table) => [uniqueIndex('news_event_assets_event_asset_unique').on(table.eventId, table.assetId)]);

export const newsScores = sqliteTable('news_scores', {
  id: integer().primaryKey({ autoIncrement: true }),
  assetId: integer('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  date: text().notNull(),
  score: real().notNull(),
  eventCount: integer('event_count').notNull(),
  divergence: text(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('news_scores_asset_date_unique').on(table.assetId, table.date)]);

export const economicEvents = sqliteTable('economic_events', {
  id: integer().primaryKey({ autoIncrement: true }),
  eventName: text('event_name').notNull(),
  eventType: text('event_type').notNull(),
  country: text().notNull(),
  scheduledAt: text('scheduled_at').notNull(),
  previousValue: text('previous_value'),
  consensusValue: text('consensus_value'),
  actualValue: text('actual_value'),
  expectedImpact: real('expected_impact').notNull(),
  status: text().notNull().default('SCHEDULED'),
  sourceUrl: text('source_url'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('economic_events_type_time_country_unique')
  .on(table.eventType, table.scheduledAt, table.country)]);

export const economicEventAssets = sqliteTable('economic_event_assets', {
  id: integer().primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => economicEvents.id, { onDelete: 'cascade' }),
  assetId: integer('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
}, (table) => [uniqueIndex('economic_event_assets_event_asset_unique').on(table.eventId, table.assetId)]);

export const notificationSettings = sqliteTable('notification_settings', {
  id: integer().primaryKey({ autoIncrement: true }),
  channel: text().notNull().unique(),
  enabled: integer({ mode: 'boolean' }).notNull().default(false),
  sendTime: text('send_time').notNull().default('08:00'),
  timezone: text().notNull().default('Asia/Seoul'),
  configJson: text('config_json').notNull().default('{}'),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const notificationDeliveries = sqliteTable('notification_deliveries', {
  id: integer().primaryKey({ autoIncrement: true }),
  settingId: integer('setting_id').notNull().references(() => notificationSettings.id, { onDelete: 'cascade' }),
  reportId: integer('report_id').notNull().references(() => reports.id, { onDelete: 'cascade' }),
  status: text().notNull(),
  errorMessage: text('error_message'),
  sentAt: text('sent_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('notification_deliveries_setting_report_unique').on(table.settingId, table.reportId)]);

export const jobRuns = sqliteTable('job_runs', {
  id: integer().primaryKey({ autoIncrement: true }),
  jobName: text('job_name').notNull(),
  startedAt: text('started_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  finishedAt: text('finished_at'),
  status: text().notNull(),
  errorMessage: text('error_message'),
});

export const kisSnapshots = sqliteTable('kis_snapshots', {
  id: integer().primaryKey({ autoIncrement: true }),
  snapshotKey: text('snapshot_key').notNull(),
  snapshotDate: text('snapshot_date').notNull(),
  scope: text().notNull(),
  symbol: text().notNull(),
  payloadJson: text('payload_json').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('kis_snapshots_key_date_unique').on(table.snapshotKey, table.snapshotDate)]);
