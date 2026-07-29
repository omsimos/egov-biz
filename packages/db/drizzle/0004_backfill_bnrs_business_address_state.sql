UPDATE "bnrs_applications"
SET "state" = 'BUSINESS_ADDRESS_PENDING', "updated_at" = now()
WHERE "state" = 'PAYMENT_READY';
