CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`raw_profile_json` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_expires` ON `auth_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`initial_prompt` text NOT NULL,
	`active_stream_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_conversations_updated` ON `conversations` (`updated_at`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`parts_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_messages_conversation_created` ON `messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`transaction_uuid` text NOT NULL,
	`transaction_id` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text NOT NULL,
	`proposed_name` text NOT NULL,
	`territorial_scope` text NOT NULL,
	`owner_name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`paid_at` text,
	`service_type` text DEFAULT 'dti-business-name' NOT NULL,
	`service_reference` text,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_transaction_uuid_unique` ON `payments` (`transaction_uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_transaction_id_unique` ON `payments` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_payments_conversation_created` ON `payments` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_payments_conversation_service` ON `payments` (`conversation_id`,`service_type`,`created_at`);--> statement-breakpoint
CREATE TABLE `registered_businesses` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`registration_number` text NOT NULL,
	`status` text NOT NULL,
	`owner_name` text NOT NULL,
	`business_activity` text NOT NULL,
	`business_address` text NOT NULL,
	`city` text NOT NULL,
	`rdo` text NOT NULL,
	`tin_masked` text NOT NULL,
	`records_json` text NOT NULL,
	`tax_obligations_json` text NOT NULL,
	`files_json` text DEFAULT '[]' NOT NULL,
	`finalized_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `registered_businesses_conversation_id_unique` ON `registered_businesses` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `idx_registered_businesses_profile_updated` ON `registered_businesses` (`profile_id`,`updated_at`);