CREATE TABLE `email_recipients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_recipients_email_unique` ON `email_recipients` (`email`);--> statement-breakpoint
ALTER TABLE `economic_events` ADD `external_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `economic_events_external_id_unique` ON `economic_events` (`external_id`);