CREATE TYPE "public"."lgu_application_state" AS ENUM('PAYMENT_READY', 'PAYMENT_PENDING', 'COMPLETED', 'ABANDONED');--> statement-breakpoint
CREATE TYPE "public"."lgu_payment_status" AS ENUM('CREATING', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'VOIDED');--> statement-breakpoint
CREATE TYPE "public"."lgu_territorial_scope" AS ENUM('CITY_MUNICIPALITY', 'REGIONAL', 'NATIONAL');--> statement-breakpoint
CREATE TABLE "lgu_applicant_information" (
	"application_id" uuid PRIMARY KEY NOT NULL,
	"owner_name" text NOT NULL,
	"normalized_owner_name" text NOT NULL,
	"tin" varchar(14),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lgu_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"egov_user_id" text NOT NULL,
	"state" "lgu_application_state" DEFAULT 'PAYMENT_READY' NOT NULL,
	"city" text NOT NULL,
	"normalized_city" text NOT NULL,
	"certificate_number" varchar(40) NOT NULL,
	"certificate_issuing_agency" varchar(40) NOT NULL,
	"certificate_status" varchar(20) NOT NULL,
	"certificate_business_name" text NOT NULL,
	"certificate_owner_name" text NOT NULL,
	"certificate_descriptor" text NOT NULL,
	"certificate_territorial_scope" "lgu_territorial_scope" NOT NULL,
	"certificate_issued_at" timestamp with time zone NOT NULL,
	"certificate_valid_until" timestamp with time zone NOT NULL,
	"latest_payment_id" uuid,
	"permit_number" varchar(40),
	"barangay_clearance_number" varchar(40),
	"documents_issued_at" timestamp with time zone,
	"documents_valid_until" timestamp with time zone,
	"abandoned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lgu_certificate_dates_valid" CHECK ("lgu_applications"."certificate_issued_at" <= "lgu_applications"."certificate_valid_until"),
	CONSTRAINT "lgu_certificate_credential_supported" CHECK ("lgu_applications"."certificate_issuing_agency" = 'DTI-BNRS' and "lgu_applications"."certificate_status" = 'REGISTERED'),
	CONSTRAINT "lgu_issued_documents_complete" CHECK (("lgu_applications"."state" = 'COMPLETED' and "lgu_applications"."permit_number" is not null and "lgu_applications"."barangay_clearance_number" is not null and "lgu_applications"."documents_issued_at" is not null and "lgu_applications"."documents_valid_until" is not null) or ("lgu_applications"."state" <> 'COMPLETED' and "lgu_applications"."permit_number" is null and "lgu_applications"."barangay_clearance_number" is null and "lgu_applications"."documents_issued_at" is null and "lgu_applications"."documents_valid_until" is null))
);
--> statement-breakpoint
CREATE TABLE "lgu_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"provider" varchar(40) DEFAULT 'EGOVPAY' NOT NULL,
	"status" "lgu_payment_status" DEFAULT 'CREATING' NOT NULL,
	"transaction_id" varchar(150) NOT NULL,
	"transaction_uuid" uuid,
	"checkout_url" text,
	"provider_callback_url" text NOT NULL,
	"provider_redirect_url" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'PHP' NOT NULL,
	"provider_status" text,
	"paid_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lgu_payment_assessment_fixed" CHECK ("lgu_payments"."amount" = 2500 and "lgu_payments"."currency" = 'PHP'),
	CONSTRAINT "lgu_payment_provider_state_complete" CHECK (("lgu_payments"."status" = 'CREATING' and "lgu_payments"."transaction_uuid" is null and "lgu_payments"."paid_at" is null) or ("lgu_payments"."status" <> 'CREATING' and "lgu_payments"."transaction_uuid" is not null and "lgu_payments"."provider_status" is not null and (("lgu_payments"."status" = 'PAID' and "lgu_payments"."paid_at" is not null) or ("lgu_payments"."status" <> 'PAID' and "lgu_payments"."paid_at" is null))))
);
--> statement-breakpoint
ALTER TABLE "lgu_applicant_information" ADD CONSTRAINT "lgu_applicant_information_application_id_lgu_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."lgu_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lgu_payments" ADD CONSTRAINT "lgu_payments_application_id_lgu_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."lgu_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lgu_one_application_per_business_city" ON "lgu_applications" USING btree ("egov_user_id","certificate_number","normalized_city") WHERE "lgu_applications"."state" <> 'ABANDONED';--> statement-breakpoint
CREATE UNIQUE INDEX "lgu_permit_number_unique" ON "lgu_applications" USING btree ("permit_number") WHERE "lgu_applications"."permit_number" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "lgu_barangay_clearance_number_unique" ON "lgu_applications" USING btree ("barangay_clearance_number") WHERE "lgu_applications"."barangay_clearance_number" is not null;--> statement-breakpoint
CREATE INDEX "lgu_applications_user_history" ON "lgu_applications" USING btree ("egov_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lgu_one_pending_payment_per_application" ON "lgu_payments" USING btree ("application_id") WHERE "lgu_payments"."status" in ('CREATING', 'PENDING');--> statement-breakpoint
CREATE UNIQUE INDEX "lgu_payment_transaction_uuid_unique" ON "lgu_payments" USING btree ("transaction_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "lgu_payment_transaction_id_unique" ON "lgu_payments" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "lgu_payments_application_history" ON "lgu_payments" USING btree ("application_id","created_at");