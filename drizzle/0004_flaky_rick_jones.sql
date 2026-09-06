CREATE TABLE `news_event_assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`asset_id` integer NOT NULL,
	`relevance_score` real NOT NULL,
	`sentiment_score` real NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `news_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `news_event_assets_event_asset_unique` ON `news_event_assets` (`event_id`,`asset_id`);--> statement-breakpoint
CREATE TABLE `news_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fingerprint` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`category` text NOT NULL,
	`event_time` text NOT NULL,
	`sentiment` text NOT NULL,
	`sentiment_score` real NOT NULL,
	`impact_score` real NOT NULL,
	`confidence_score` real NOT NULL,
	`duration_type` text NOT NULL,
	`affected_groups` text DEFAULT '[]' NOT NULL,
	`is_duplicate_group` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `news_events_fingerprint_unique` ON `news_events` (`fingerprint`);--> statement-breakpoint
CREATE TABLE `news_scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_id` integer NOT NULL,
	`date` text NOT NULL,
	`score` real NOT NULL,
	`event_count` integer NOT NULL,
	`divergence` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `news_scores_asset_date_unique` ON `news_scores` (`asset_id`,`date`);--> statement-breakpoint
CREATE TABLE `news_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`source` text NOT NULL,
	`source_url` text NOT NULL,
	`source_rank` integer NOT NULL,
	`published_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `news_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `news_sources_url_unique` ON `news_sources` (`source_url`);