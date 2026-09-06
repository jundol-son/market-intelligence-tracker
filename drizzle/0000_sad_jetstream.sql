CREATE TABLE `assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symbol` text NOT NULL,
	`name` text NOT NULL,
	`asset_type` text NOT NULL,
	`market` text NOT NULL,
	`currency` text NOT NULL,
	`benchmark_asset_id` integer,
	`group_id` integer,
	`enabled` integer DEFAULT true NOT NULL,
	`importance_weight` real DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_symbol_unique` ON `assets` (`symbol`);
--> statement-breakpoint
PRAGMA optimize;
