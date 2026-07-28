CREATE TYPE "public"."bnrs_application_state" AS ENUM('TERMS_PENDING', 'OWNER_INFORMATION_PENDING', 'BUSINESS_NAME_PENDING', 'SCOPE_PENDING', 'PAYMENT_READY', 'PAYMENT_PENDING', 'COMPLETED', 'ABANDONED');--> statement-breakpoint
CREATE TYPE "public"."bnrs_business_scope" AS ENUM('CITY_MUNICIPALITY', 'REGIONAL', 'NATIONAL');--> statement-breakpoint
CREATE TYPE "public"."bnrs_payment_status" AS ENUM('CREATING', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'VOIDED');--> statement-breakpoint
CREATE TABLE "bnrs_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"egov_user_id" text NOT NULL,
	"state" "bnrs_application_state" DEFAULT 'TERMS_PENDING' NOT NULL,
	"terms_accepted_at" timestamp with time zone,
	"dominant_name" text,
	"descriptor_id" varchar(100),
	"descriptor_label" text,
	"proposed_business_name" text,
	"normalized_business_name" text,
	"scope" "bnrs_business_scope",
	"registration_fee" integer,
	"documentary_stamp_tax" integer,
	"total_fee" integer,
	"latest_payment_id" uuid,
	"reference_code" varchar(32),
	"issued_at" timestamp with time zone,
	"abandoned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bnrs_owner_information" (
	"application_id" uuid PRIMARY KEY NOT NULL,
	"citizenship" text,
	"first_name" text,
	"middle_name" text,
	"last_name" text,
	"suffix" text,
	"birth_date" date,
	"gender" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bnrs_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"provider" varchar(40) DEFAULT 'EGOVPAY' NOT NULL,
	"status" "bnrs_payment_status" DEFAULT 'CREATING' NOT NULL,
	"transaction_id" varchar(150) NOT NULL,
	"transaction_uuid" uuid,
	"checkout_url" text,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'PHP' NOT NULL,
	"provider_status" text,
	"paid_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bnrs_owner_information" ADD CONSTRAINT "bnrs_owner_information_application_id_bnrs_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."bnrs_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bnrs_payments" ADD CONSTRAINT "bnrs_payments_application_id_bnrs_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."bnrs_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bnrs_one_active_application_per_user" ON "bnrs_applications" USING btree ("egov_user_id") WHERE "bnrs_applications"."state" not in ('COMPLETED', 'ABANDONED');--> statement-breakpoint
CREATE UNIQUE INDEX "bnrs_reserved_business_name_unique" ON "bnrs_applications" USING btree ("normalized_business_name") WHERE "bnrs_applications"."state" in ('PAYMENT_PENDING', 'COMPLETED');--> statement-breakpoint
CREATE UNIQUE INDEX "bnrs_reference_code_unique" ON "bnrs_applications" USING btree ("reference_code") WHERE "bnrs_applications"."reference_code" is not null;--> statement-breakpoint
CREATE INDEX "bnrs_applications_user_history" ON "bnrs_applications" USING btree ("egov_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bnrs_one_pending_payment_per_application" ON "bnrs_payments" USING btree ("application_id") WHERE "bnrs_payments"."status" in ('CREATING', 'PENDING');--> statement-breakpoint
CREATE UNIQUE INDEX "bnrs_payment_transaction_uuid_unique" ON "bnrs_payments" USING btree ("transaction_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "bnrs_payment_transaction_id_unique" ON "bnrs_payments" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "bnrs_payments_application_history" ON "bnrs_payments" USING btree ("application_id","created_at");