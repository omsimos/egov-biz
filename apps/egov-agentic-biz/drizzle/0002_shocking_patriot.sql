CREATE TABLE `sms_dispatches` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`user_message_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`status` text NOT NULL,
	`output_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sms_dispatches_conversation_created` ON `sms_dispatches` (`conversation_id`,`created_at`);