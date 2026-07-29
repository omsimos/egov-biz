ALTER TABLE `conversations` ADD `purpose` text DEFAULT 'registration' NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `business_id` text;--> statement-breakpoint
CREATE INDEX `idx_conversations_business_updated` ON `conversations` (`business_id`,`updated_at`);