CREATE TABLE `economic_event_assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`asset_id` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `economic_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `economic_event_assets_event_asset_unique` ON `economic_event_assets` (`event_id`,`asset_id`);--> statement-breakpoint
CREATE TABLE `economic_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_name` text NOT NULL,
	`event_type` text NOT NULL,
	`country` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`previous_value` text,
	`consensus_value` text,
	`actual_value` text,
	`expected_impact` real NOT NULL,
	`status` text DEFAULT 'SCHEDULED' NOT NULL,
	`source_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `economic_events_type_time_country_unique` ON `economic_events` (`event_type`,`scheduled_at`,`country`);
--> statement-breakpoint
INSERT OR IGNORE INTO `economic_events`
  (`event_name`, `event_type`, `country`, `scheduled_at`, `expected_impact`, `status`, `source_url`)
VALUES
  ('미국 생산자물가지수 (2026년 8월)', 'PPI', 'US', '2026-09-10T12:30:00.000Z', 85, 'SCHEDULED', 'https://www.bls.gov/schedule/2026/09_sched.htm'),
  ('미국 소비자물가지수 (2026년 8월)', 'CPI', 'US', '2026-09-11T12:30:00.000Z', 95, 'SCHEDULED', 'https://www.bls.gov/schedule/2026/09_sched.htm'),
  ('FOMC 금리 결정', 'FOMC', 'US', '2026-09-16T18:00:00.000Z', 98, 'SCHEDULED', 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'),
  ('미국 고용보고서 (2026년 9월)', 'EMPLOYMENT', 'US', '2026-10-02T12:30:00.000Z', 95, 'SCHEDULED', 'https://www.bls.gov/schedule/news_release/empsit.htm');
--> statement-breakpoint
INSERT OR IGNORE INTO `economic_event_assets` (`event_id`, `asset_id`)
SELECT e.id, a.id FROM `economic_events` e CROSS JOIN `assets` a
WHERE a.symbol='NVDA' AND e.event_type IN ('PPI', 'CPI', 'FOMC', 'EMPLOYMENT');
