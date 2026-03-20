CREATE TABLE `imap_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`host` text NOT NULL,
	`port` integer DEFAULT 993 NOT NULL,
	`mailbox` text DEFAULT 'INBOX' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_polled_at` integer,
	`last_uid` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `imap_settings_user_id_unique` ON `imap_settings` (`user_id`);
--> statement-breakpoint
CREATE TABLE `llm_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text DEFAULT 'openai' NOT NULL,
	`api_key` text,
	`model` text DEFAULT 'gpt-4o-mini' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `llm_settings_user_id_unique` ON `llm_settings` (`user_id`);
--> statement-breakpoint
CREATE TABLE `parsed_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`pending_message_id` text,
	`account_id` text,
	`category_id` text,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`date` integer NOT NULL,
	`description` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'pending_review' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pending_message_id`) REFERENCES `pending_messages`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `pending_messages` ADD `subject` text;
