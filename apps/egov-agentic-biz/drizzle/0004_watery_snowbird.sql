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