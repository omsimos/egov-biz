CREATE TABLE `sms_dispatches` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`user_message_id` text NOT NULL,
	`profile_id` text,
	`recipient_hash` text,
	`tool_name` text NOT NULL,
	`status` text NOT NULL,
	`output_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sms_dispatches_conversation_created` ON `sms_dispatches` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_sms_dispatches_profile_created` ON `sms_dispatches` (`profile_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_sms_dispatches_recipient_created` ON `sms_dispatches` (`recipient_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `sms_quota_buckets` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`max_count` integer NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "sms_quota_count_valid" CHECK("sms_quota_buckets"."count" >= 1 AND "sms_quota_buckets"."count" <= "sms_quota_buckets"."max_count")
);
--> statement-breakpoint
CREATE INDEX `idx_sms_quota_buckets_expires` ON `sms_quota_buckets` (`expires_at`);
