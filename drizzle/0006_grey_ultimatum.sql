CREATE TABLE `similar_days` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`target_asset_id` integer NOT NULL,
	`historical_date` text NOT NULL,
	`similarity_score` real NOT NULL,
	`next_day_return` real NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `similar_days_report_asset_date_unique` ON `similar_days` (`report_id`,`target_asset_id`,`historical_date`);