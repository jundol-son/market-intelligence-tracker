CREATE TABLE `forecast_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`forecast_id` integer NOT NULL,
	`actual_return` real NOT NULL,
	`direction_hit` integer NOT NULL,
	`range_hit` integer NOT NULL,
	`evaluated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`forecast_id`) REFERENCES `forecasts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `forecast_results_forecast_unique` ON `forecast_results` (`forecast_id`);--> statement-breakpoint
CREATE TABLE `forecasts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`target_asset_id` integer NOT NULL,
	`up_probability` real NOT NULL,
	`down_probability` real NOT NULL,
	`expected_low` real NOT NULL,
	`expected_high` real NOT NULL,
	`bull_probability` real NOT NULL,
	`base_probability` real NOT NULL,
	`bear_probability` real NOT NULL,
	`confidence` real NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `forecasts_report_asset_unique` ON `forecasts` (`report_id`,`target_asset_id`);--> statement-breakpoint
CREATE TABLE `report_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`asset_id` integer NOT NULL,
	`symbol` text NOT NULL,
	`name` text NOT NULL,
	`price` real,
	`daily_return` real,
	`ma20` real,
	`ma60` real,
	`ma120` real,
	`ma200` real,
	`ma20_distance` real,
	`ma60_distance` real,
	`ma120_distance` real,
	`ma200_distance` real,
	`rsi` real,
	`trend_score` real,
	`momentum_score` real,
	`risk_score` real,
	`news_score` real,
	`composite_score` real,
	`score_change` real,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_metrics_report_asset_unique` ON `report_metrics` (`report_id`,`asset_id`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_date` text NOT NULL,
	`report_type` text DEFAULT 'DAILY' NOT NULL,
	`overall_score` real NOT NULL,
	`global_score` real,
	`korea_score` real,
	`market_regime` text NOT NULL,
	`summary` text NOT NULL,
	`up_probability` real,
	`down_probability` real,
	`expected_low` real,
	`expected_high` real,
	`bull_probability` real,
	`base_probability` real,
	`bear_probability` real,
	`confidence` real,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reports_date_type_unique` ON `reports` (`report_date`,`report_type`);