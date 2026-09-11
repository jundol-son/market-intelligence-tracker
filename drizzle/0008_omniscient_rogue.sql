CREATE TABLE `kis_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_key` text NOT NULL,
	`snapshot_date` text NOT NULL,
	`scope` text NOT NULL,
	`symbol` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kis_snapshots_key_date_unique` ON `kis_snapshots` (`snapshot_key`,`snapshot_date`);