import { randomUUID } from "node:crypto";
import { relations, sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
};

const applicationStates = [
  "TERMS_PENDING",
  "OWNER_INFORMATION_PENDING",
  "BUSINESS_NAME_PENDING",
  "SCOPE_PENDING",
  "BUSINESS_ADDRESS_PENDING",
  "PAYMENT_READY",
  "PAYMENT_PENDING",
  "COMPLETED",
  "ABANDONED",
] as const;

const businessScopes = ["CITY_MUNICIPALITY", "REGIONAL", "NATIONAL"] as const;
const businessAddressSources = ["EGOV_RESIDENTIAL", "USER_PROVIDED"] as const;
const paymentStatuses = ["CREATING", "PENDING", "PAID", "FAILED", "EXPIRED", "VOIDED"] as const;

export const bnrsApplications = sqliteTable(
  "bnrs_applications",
  {
    id: text("id").$defaultFn(randomUUID).primaryKey(),
    egovUserId: text("egov_user_id").notNull(),
    state: text("state", { enum: applicationStates }).default("TERMS_PENDING").notNull(),
    termsAcceptedAt: integer("terms_accepted_at", { mode: "timestamp_ms" }),
    dominantName: text("dominant_name"),
    descriptorId: text("descriptor_id"),
    descriptorLabel: text("descriptor_label"),
    proposedBusinessName: text("proposed_business_name"),
    normalizedBusinessName: text("normalized_business_name"),
    scope: text("scope", { enum: businessScopes }),
    registrationFee: integer("registration_fee"),
    documentaryStampTax: integer("documentary_stamp_tax"),
    totalFee: integer("total_fee"),
    latestPaymentId: text("latest_payment_id"),
    referenceCode: text("reference_code"),
    certificateNumber: text("certificate_number"),
    issuedAt: integer("issued_at", { mode: "timestamp_ms" }),
    validUntil: integer("valid_until", { mode: "timestamp_ms" }),
    abandonedAt: integer("abandoned_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("bnrs_one_active_application_per_user")
      .on(table.egovUserId)
      .where(sql`${table.state} not in ('COMPLETED', 'ABANDONED')`),
    uniqueIndex("bnrs_reserved_business_name_unique")
      .on(table.normalizedBusinessName)
      .where(sql`${table.state} in ('PAYMENT_PENDING', 'COMPLETED')`),
    uniqueIndex("bnrs_reference_code_unique")
      .on(table.referenceCode)
      .where(sql`${table.referenceCode} is not null`),
    uniqueIndex("bnrs_certificate_number_unique")
      .on(table.certificateNumber)
      .where(sql`${table.certificateNumber} is not null`),
    check(
      "bnrs_application_state_valid",
      sql`${table.state} in ('TERMS_PENDING', 'OWNER_INFORMATION_PENDING', 'BUSINESS_NAME_PENDING', 'SCOPE_PENDING', 'BUSINESS_ADDRESS_PENDING', 'PAYMENT_READY', 'PAYMENT_PENDING', 'COMPLETED', 'ABANDONED')`,
    ),
    check(
      "bnrs_business_scope_valid",
      sql`${table.scope} is null or ${table.scope} in ('CITY_MUNICIPALITY', 'REGIONAL', 'NATIONAL')`,
    ),
    check(
      "bnrs_certificate_issuance_complete",
      sql`(${table.certificateNumber} is null and ${table.validUntil} is null) or (${table.certificateNumber} is not null and ${table.validUntil} is not null and ${table.state} = 'COMPLETED')`,
    ),
    index("bnrs_applications_user_history").on(table.egovUserId, table.createdAt),
  ],
);

export const bnrsOwnerInformation = sqliteTable("bnrs_owner_information", {
  applicationId: text("application_id")
    .primaryKey()
    .references(() => bnrsApplications.id, { onDelete: "cascade" }),
  citizenship: text("citizenship"),
  firstName: text("first_name"),
  middleName: text("middle_name"),
  lastName: text("last_name"),
  suffix: text("suffix"),
  birthDate: text("birth_date"),
  gender: text("gender"),
  ...timestamps,
});

export const bnrsBusinessAddresses = sqliteTable(
  "bnrs_business_addresses",
  {
    applicationId: text("application_id")
      .primaryKey()
      .references(() => bnrsApplications.id, { onDelete: "cascade" }),
    source: text("source", { enum: businessAddressSources }).notNull(),
    addressLine1: text("address_line_1").notNull(),
    addressLine2: text("address_line_2"),
    barangay: text("barangay").notNull(),
    cityMunicipality: text("city_municipality").notNull(),
    province: text("province").notNull(),
    region: text("region").notNull(),
    postalCode: text("postal_code").notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "bnrs_business_address_source_valid",
      sql`${table.source} in ('EGOV_RESIDENTIAL', 'USER_PROVIDED')`,
    ),
  ],
);

export const bnrsPayments = sqliteTable(
  "bnrs_payments",
  {
    id: text("id").$defaultFn(randomUUID).primaryKey(),
    applicationId: text("application_id")
      .notNull()
      .references(() => bnrsApplications.id, { onDelete: "cascade" }),
    provider: text("provider").default("EGOVPAY").notNull(),
    status: text("status", { enum: paymentStatuses }).default("CREATING").notNull(),
    transactionId: text("transaction_id").notNull(),
    transactionUuid: text("transaction_uuid"),
    checkoutUrl: text("checkout_url"),
    amount: integer("amount").notNull(),
    currency: text("currency").default("PHP").notNull(),
    providerStatus: text("provider_status"),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("bnrs_one_pending_payment_per_application")
      .on(table.applicationId)
      .where(sql`${table.status} in ('CREATING', 'PENDING')`),
    uniqueIndex("bnrs_payment_transaction_uuid_unique").on(table.transactionUuid),
    uniqueIndex("bnrs_payment_transaction_id_unique").on(table.transactionId),
    check(
      "bnrs_payment_status_valid",
      sql`${table.status} in ('CREATING', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'VOIDED')`,
    ),
    index("bnrs_payments_application_history").on(table.applicationId, table.createdAt),
  ],
);

export const bnrsApplicationsRelations = relations(bnrsApplications, ({ many, one }) => ({
  ownerInformation: one(bnrsOwnerInformation, {
    fields: [bnrsApplications.id],
    references: [bnrsOwnerInformation.applicationId],
  }),
  businessAddress: one(bnrsBusinessAddresses, {
    fields: [bnrsApplications.id],
    references: [bnrsBusinessAddresses.applicationId],
  }),
  payments: many(bnrsPayments),
}));

export const bnrsOwnerInformationRelations = relations(bnrsOwnerInformation, ({ one }) => ({
  application: one(bnrsApplications, {
    fields: [bnrsOwnerInformation.applicationId],
    references: [bnrsApplications.id],
  }),
}));

export const bnrsBusinessAddressesRelations = relations(bnrsBusinessAddresses, ({ one }) => ({
  application: one(bnrsApplications, {
    fields: [bnrsBusinessAddresses.applicationId],
    references: [bnrsApplications.id],
  }),
}));

export const bnrsPaymentsRelations = relations(bnrsPayments, ({ one }) => ({
  application: one(bnrsApplications, {
    fields: [bnrsPayments.applicationId],
    references: [bnrsApplications.id],
  }),
}));

export type BnrsApplicationRow = typeof bnrsApplications.$inferSelect;
export type NewBnrsApplicationRow = typeof bnrsApplications.$inferInsert;
export type BnrsOwnerInformationRow = typeof bnrsOwnerInformation.$inferSelect;
export type NewBnrsOwnerInformationRow = typeof bnrsOwnerInformation.$inferInsert;
export type BnrsBusinessAddressRow = typeof bnrsBusinessAddresses.$inferSelect;
export type NewBnrsBusinessAddressRow = typeof bnrsBusinessAddresses.$inferInsert;
export type BnrsPaymentRow = typeof bnrsPayments.$inferSelect;
export type NewBnrsPaymentRow = typeof bnrsPayments.$inferInsert;
