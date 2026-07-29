ALTER TABLE "bnrs_applications" ADD COLUMN "certificate_number" varchar(40);--> statement-breakpoint
ALTER TABLE "bnrs_applications" ADD COLUMN "valid_until" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "bnrs_certificate_number_unique" ON "bnrs_applications" USING btree ("certificate_number") WHERE "bnrs_applications"."certificate_number" is not null;--> statement-breakpoint
ALTER TABLE "bnrs_applications" ADD CONSTRAINT "bnrs_certificate_issuance_complete" CHECK (("bnrs_applications"."certificate_number" is null and "bnrs_applications"."valid_until" is null) or ("bnrs_applications"."certificate_number" is not null and "bnrs_applications"."valid_until" is not null and "bnrs_applications"."state" = 'COMPLETED'));
