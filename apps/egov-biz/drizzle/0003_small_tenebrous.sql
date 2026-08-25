CREATE TABLE `conversation_artifacts` (
	`artifact_id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`owner_egov_user_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_conversation_artifacts_conversation_created` ON `conversation_artifacts` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_conversation_artifacts_owner_created` ON `conversation_artifacts` (`owner_egov_user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `conversations` ADD `owner_egov_user_id` text;--> statement-breakpoint
ALTER TABLE `conversations` ADD `bnrs_application_id` text;--> statement-breakpoint
ALTER TABLE `conversations` ADD `bnrs_transaction_uuid` text;--> statement-breakpoint
ALTER TABLE `conversations` ADD `bnrs_certificate_number` text;--> statement-breakpoint
ALTER TABLE `conversations` ADD `lgu_application_id` text;--> statement-breakpoint
ALTER TABLE `conversations` ADD `lgu_transaction_uuid` text;--> statement-breakpoint
CREATE INDEX `idx_conversations_owner_updated` ON `conversations` (`owner_egov_user_id`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_conversations_bnrs_application` ON `conversations` (`bnrs_application_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_conversations_bnrs_transaction` ON `conversations` (`bnrs_transaction_uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_conversations_bnrs_certificate` ON `conversations` (`bnrs_certificate_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_conversations_lgu_application` ON `conversations` (`lgu_application_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_conversations_lgu_transaction` ON `conversations` (`lgu_transaction_uuid`);
