CREATE TYPE "public"."bnrs_business_address_source" AS ENUM('EGOV_RESIDENTIAL', 'USER_PROVIDED');--> statement-breakpoint
DROP INDEX "bnrs_one_active_application_per_user";--> statement-breakpoint
DROP INDEX "bnrs_reserved_business_name_unique";--> statement-breakpoint
ALTER TABLE "bnrs_applications" DROP CONSTRAINT "bnrs_certificate_issuance_complete";--> statement-breakpoint
ALTER TABLE "bnrs_applications" ALTER COLUMN "state" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."bnrs_application_state" RENAME TO "bnrs_application_state_old";--> statement-breakpoint
CREATE TYPE "public"."bnrs_application_state" AS ENUM('TERMS_PENDING', 'OWNER_INFORMATION_PENDING', 'BUSINESS_NAME_PENDING', 'SCOPE_PENDING', 'BUSINESS_ADDRESS_PENDING', 'PAYMENT_READY', 'PAYMENT_PENDING', 'COMPLETED', 'ABANDONED');--> statement-breakpoint
ALTER TABLE "bnrs_applications" ALTER COLUMN "state" TYPE "public"."bnrs_application_state" USING "state"::text::"public"."bnrs_application_state";--> statement-breakpoint
ALTER TABLE "bnrs_applications" ALTER COLUMN "state" SET DEFAULT 'TERMS_PENDING';--> statement-breakpoint
DROP TYPE "public"."bnrs_application_state_old";--> statement-breakpoint
CREATE UNIQUE INDEX "bnrs_one_active_application_per_user" ON "bnrs_applications" USING btree ("egov_user_id") WHERE "bnrs_applications"."state" not in ('COMPLETED', 'ABANDONED');--> statement-breakpoint
CREATE UNIQUE INDEX "bnrs_reserved_business_name_unique" ON "bnrs_applications" USING btree ("normalized_business_name") WHERE "bnrs_applications"."state" in ('PAYMENT_PENDING', 'COMPLETED');--> statement-breakpoint
ALTER TABLE "bnrs_applications" ADD CONSTRAINT "bnrs_certificate_issuance_complete" CHECK (("bnrs_applications"."certificate_number" is null and "bnrs_applications"."valid_until" is null) or ("bnrs_applications"."certificate_number" is not null and "bnrs_applications"."valid_until" is not null and "bnrs_applications"."state" = 'COMPLETED'));--> statement-breakpoint
CREATE TABLE "bnrs_business_addresses" (
	"application_id" uuid PRIMARY KEY NOT NULL,
	"source" "bnrs_business_address_source" NOT NULL,
	"address_line_1" text NOT NULL,
	"address_line_2" text,
	"barangay" text NOT NULL,
	"city_municipality" text NOT NULL,
	"province" text NOT NULL,
	"region" text NOT NULL,
	"postal_code" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bnrs_business_addresses" ADD CONSTRAINT "bnrs_business_addresses_application_id_bnrs_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."bnrs_applications"("id") ON DELETE cascade ON UPDATE no action;
