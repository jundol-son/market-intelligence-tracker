CREATE TABLE `asset_indicators` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_id` integer NOT NULL,
	`date` text NOT NULL,
	`ma5` real,
	`ma20` real,
	`ma60` real,
	`ma120` real,
	`ma200` real,
	`ma20_distance` real,
	`ma60_distance` real,
	`ma120_distance` real,
	`ma200_distance` real,
	`ma20_slope` real,
	`ma60_slope` real,
	`rsi14` real,
	`atr14` real,
	`return_1d` real,
	`return_5d` real,
	`return_20d` real,
	`return_60d` real,
	`volume_ratio` real,
	`relative_strength` real,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_indicators_asset_date_unique` ON `asset_indicators` (`asset_id`,`date`);--> statement-breakpoint
CREATE TABLE `asset_prices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_id` integer NOT NULL,
	`date` text NOT NULL,
	`open` real NOT NULL,
	`high` real NOT NULL,
	`low` real NOT NULL,
	`close` real NOT NULL,
	`volume` real NOT NULL,
	`source` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_prices_asset_date_unique` ON `asset_prices` (`asset_id`,`date`);