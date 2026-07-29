CREATE TABLE `bnrs_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`egov_user_id` text NOT NULL,
	`state` text DEFAULT 'TERMS_PENDING' NOT NULL,
	`terms_accepted_at` integer,
	`dominant_name` text,
	`descriptor_id` text,
	`descriptor_label` text,
	`proposed_business_name` text,
	`normalized_business_name` text,
	`scope` text,
	`registration_fee` integer,
	`documentary_stamp_tax` integer,
	`total_fee` integer,
	`latest_payment_id` text,
	`reference_code` text,
	`certificate_number` text,
	`issued_at` integer,
	`valid_until` integer,
	`abandoned_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "bnrs_application_state_valid" CHECK("bnrs_applications"."state" in ('TERMS_PENDING', 'OWNER_INFORMATION_PENDING', 'BUSINESS_NAME_PENDING', 'SCOPE_PENDING', 'BUSINESS_ADDRESS_PENDING', 'PAYMENT_READY', 'PAYMENT_PENDING', 'COMPLETED', 'ABANDONED')),
	CONSTRAINT "bnrs_business_scope_valid" CHECK("bnrs_applications"."scope" is null or "bnrs_applications"."scope" in ('CITY_MUNICIPALITY', 'REGIONAL', 'NATIONAL')),
	CONSTRAINT "bnrs_certificate_issuance_complete" CHECK(("bnrs_applications"."certificate_number" is null and "bnrs_applications"."valid_until" is null) or ("bnrs_applications"."certificate_number" is not null and "bnrs_applications"."valid_until" is not null and "bnrs_applications"."state" = 'COMPLETED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bnrs_one_active_application_per_user` ON `bnrs_applications` (`egov_user_id`) WHERE "bnrs_applications"."state" not in ('COMPLETED', 'ABANDONED');--> statement-breakpoint
CREATE UNIQUE INDEX `bnrs_reserved_business_name_unique` ON `bnrs_applications` (`normalized_business_name`) WHERE "bnrs_applications"."state" in ('PAYMENT_PENDING', 'COMPLETED');--> statement-breakpoint
CREATE UNIQUE INDEX `bnrs_reference_code_unique` ON `bnrs_applications` (`reference_code`) WHERE "bnrs_applications"."reference_code" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `bnrs_certificate_number_unique` ON `bnrs_applications` (`certificate_number`) WHERE "bnrs_applications"."certificate_number" is not null;--> statement-breakpoint
CREATE INDEX `bnrs_applications_user_history` ON `bnrs_applications` (`egov_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `bnrs_business_addresses` (
	`application_id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`address_line_1` text NOT NULL,
	`address_line_2` text,
	`barangay` text NOT NULL,
	`city_municipality` text NOT NULL,
	`province` text NOT NULL,
	`region` text NOT NULL,
	`postal_code` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `bnrs_applications`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "bnrs_business_address_source_valid" CHECK("bnrs_business_addresses"."source" in ('EGOV_RESIDENTIAL', 'USER_PROVIDED'))
);
--> statement-breakpoint
CREATE TABLE `bnrs_owner_information` (
	`application_id` text PRIMARY KEY NOT NULL,
	`citizenship` text,
	`first_name` text,
	`middle_name` text,
	`last_name` text,
	`suffix` text,
	`birth_date` text,
	`gender` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `bnrs_applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `bnrs_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`provider` text DEFAULT 'EGOVPAY' NOT NULL,
	`status` text DEFAULT 'CREATING' NOT NULL,
	`transaction_id` text NOT NULL,
	`transaction_uuid` text,
	`checkout_url` text,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'PHP' NOT NULL,
	`provider_status` text,
	`paid_at` integer,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `bnrs_applications`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "bnrs_payment_status_valid" CHECK("bnrs_payments"."status" in ('CREATING', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'VOIDED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bnrs_one_pending_payment_per_application` ON `bnrs_payments` (`application_id`) WHERE "bnrs_payments"."status" in ('CREATING', 'PENDING');--> statement-breakpoint
CREATE UNIQUE INDEX `bnrs_payment_transaction_uuid_unique` ON `bnrs_payments` (`transaction_uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `bnrs_payment_transaction_id_unique` ON `bnrs_payments` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `bnrs_payments_application_history` ON `bnrs_payments` (`application_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `lgu_applicant_information` (
	`application_id` text PRIMARY KEY NOT NULL,
	`owner_name` text NOT NULL,
	`normalized_owner_name` text NOT NULL,
	`tin` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `lgu_applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `lgu_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`egov_user_id` text NOT NULL,
	`state` text DEFAULT 'PAYMENT_READY' NOT NULL,
	`city` text NOT NULL,
	`normalized_city` text NOT NULL,
	`business_address_line_1` text NOT NULL,
	`business_address_line_2` text,
	`business_barangay` text NOT NULL,
	`business_province` text NOT NULL,
	`business_region` text NOT NULL,
	`business_postal_code` text NOT NULL,
	`certificate_number` text NOT NULL,
	`certificate_issuing_agency` text NOT NULL,
	`certificate_status` text NOT NULL,
	`certificate_business_name` text NOT NULL,
	`certificate_owner_name` text NOT NULL,
	`certificate_descriptor` text NOT NULL,
	`certificate_territorial_scope` text NOT NULL,
	`certificate_issued_at` integer NOT NULL,
	`certificate_valid_until` integer NOT NULL,
	`latest_payment_id` text,
	`permit_number` text,
	`barangay_clearance_number` text,
	`documents_issued_at` integer,
	`documents_valid_until` integer,
	`abandoned_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "lgu_application_state_valid" CHECK("lgu_applications"."state" in ('PAYMENT_READY', 'PAYMENT_PENDING', 'COMPLETED', 'ABANDONED')),
	CONSTRAINT "lgu_certificate_dates_valid" CHECK("lgu_applications"."certificate_issued_at" <= "lgu_applications"."certificate_valid_until"),
	CONSTRAINT "lgu_certificate_credential_supported" CHECK("lgu_applications"."certificate_issuing_agency" = 'DTI-BNRS' and "lgu_applications"."certificate_status" = 'REGISTERED'),
	CONSTRAINT "lgu_certificate_scope_valid" CHECK("lgu_applications"."certificate_territorial_scope" in ('CITY_MUNICIPALITY', 'REGIONAL', 'NATIONAL')),
	CONSTRAINT "lgu_issued_documents_complete" CHECK(("lgu_applications"."state" = 'COMPLETED' and "lgu_applications"."permit_number" is not null and "lgu_applications"."barangay_clearance_number" is not null and "lgu_applications"."documents_issued_at" is not null and "lgu_applications"."documents_valid_until" is not null) or ("lgu_applications"."state" <> 'COMPLETED' and "lgu_applications"."permit_number" is null and "lgu_applications"."barangay_clearance_number" is null and "lgu_applications"."documents_issued_at" is null and "lgu_applications"."documents_valid_until" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lgu_one_application_per_business_city` ON `lgu_applications` (`egov_user_id`,`certificate_number`,`normalized_city`) WHERE "lgu_applications"."state" <> 'ABANDONED';--> statement-breakpoint
CREATE UNIQUE INDEX `lgu_permit_number_unique` ON `lgu_applications` (`permit_number`) WHERE "lgu_applications"."permit_number" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `lgu_barangay_clearance_number_unique` ON `lgu_applications` (`barangay_clearance_number`) WHERE "lgu_applications"."barangay_clearance_number" is not null;--> statement-breakpoint
CREATE INDEX `lgu_applications_user_history` ON `lgu_applications` (`egov_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `lgu_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`provider` text DEFAULT 'EGOVPAY' NOT NULL,
	`status` text DEFAULT 'CREATING' NOT NULL,
	`transaction_id` text NOT NULL,
	`transaction_uuid` text,
	`checkout_url` text,
	`provider_callback_url` text NOT NULL,
	`provider_redirect_url` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'PHP' NOT NULL,
	`provider_status` text,
	`paid_at` integer,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `lgu_applications`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "lgu_payment_status_valid" CHECK("lgu_payments"."status" in ('CREATING', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'VOIDED')),
	CONSTRAINT "lgu_payment_assessment_fixed" CHECK("lgu_payments"."amount" = 2500 and "lgu_payments"."currency" = 'PHP'),
	CONSTRAINT "lgu_payment_provider_state_complete" CHECK(("lgu_payments"."status" = 'CREATING' and "lgu_payments"."transaction_uuid" is null and "lgu_payments"."paid_at" is null) or ("lgu_payments"."status" <> 'CREATING' and "lgu_payments"."transaction_uuid" is not null and "lgu_payments"."provider_status" is not null and (("lgu_payments"."status" = 'PAID' and "lgu_payments"."paid_at" is not null) or ("lgu_payments"."status" <> 'PAID' and "lgu_payments"."paid_at" is null))))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lgu_one_pending_payment_per_application` ON `lgu_payments` (`application_id`) WHERE "lgu_payments"."status" in ('CREATING', 'PENDING');--> statement-breakpoint
CREATE UNIQUE INDEX `lgu_payment_transaction_uuid_unique` ON `lgu_payments` (`transaction_uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `lgu_payment_transaction_id_unique` ON `lgu_payments` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `lgu_payments_application_history` ON `lgu_payments` (`application_id`,`created_at`);