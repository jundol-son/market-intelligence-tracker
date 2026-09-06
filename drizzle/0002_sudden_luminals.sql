CREATE TABLE `asset_scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_id` integer NOT NULL,
	`date` text NOT NULL,
	`trend_score` real,
	`momentum_score` real,
	`risk_score` real,
	`technical_score` real,
	`flow_score` real,
	`news_score` real,
	`relative_score` real,
	`composite_score` real NOT NULL,
	`score_change_1d` real,
	`score_change_5d` real,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_scores_asset_date_unique` ON `asset_scores` (`asset_id`,`date`);--> statement-breakpoint
CREATE TABLE `market_scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`overall_score` real NOT NULL,
	`global_score` real,
	`korea_score` real,
	`overall_change` real,
	`global_change` real,
	`korea_change` real,
	`market_regime` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `market_scores_date_unique` ON `market_scores` (`date`);--> statement-breakpoint
CREATE TABLE `score_weights` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`score_group` text NOT NULL,
	`metric_key` text NOT NULL,
	`weight` real NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `score_weights_group_metric_unique` ON `score_weights` (`score_group`,`metric_key`);