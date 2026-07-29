ALTER TABLE `sms_dispatches` ADD `profile_id` text;--> statement-breakpoint
ALTER TABLE `sms_dispatches` ADD `recipient_hash` text;--> statement-breakpoint
CREATE INDEX `idx_sms_dispatches_profile_created` ON `sms_dispatches` (`profile_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_sms_dispatches_recipient_created` ON `sms_dispatches` (`recipient_hash`,`created_at`);