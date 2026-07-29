import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
};

export const bnrsApplicationStateEnum = pgEnum("bnrs_application_state", [
  "TERMS_PENDING",
  "OWNER_INFORMATION_PENDING",
  "BUSINESS_NAME_PENDING",
  "SCOPE_PENDING",
  "BUSINESS_ADDRESS_PENDING",
  "PAYMENT_READY",
  "PAYMENT_PENDING",
  "COMPLETED",
  "ABANDONED",
]);

export const bnrsBusinessScopeEnum = pgEnum("bnrs_business_scope", [
  "CITY_MUNICIPALITY",
  "REGIONAL",
  "NATIONAL",
]);

export const bnrsBusinessAddressSourceEnum = pgEnum("bnrs_business_address_source", [
  "EGOV_RESIDENTIAL",
  "USER_PROVIDED",
]);

export const bnrsPaymentStatusEnum = pgEnum("bnrs_payment_status", [
  "CREATING",
  "PENDING",
  "PAID",
  "FAILED",
  "EXPIRED",
  "VOIDED",
]);

export const bnrsApplications = pgTable(
  "bnrs_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    egovUserId: text("egov_user_id").notNull(),
    state: bnrsApplicationStateEnum("state").default("TERMS_PENDING").notNull(),
    termsAcceptedAt: timestamp("terms_accepted_at", { mode: "date", withTimezone: true }),
    dominantName: text("dominant_name"),
    descriptorId: varchar("descriptor_id", { length: 100 }),
    descriptorLabel: text("descriptor_label"),
    proposedBusinessName: text("proposed_business_name"),
    normalizedBusinessName: text("normalized_business_name"),
    scope: bnrsBusinessScopeEnum("scope"),
    registrationFee: integer("registration_fee"),
    documentaryStampTax: integer("documentary_stamp_tax"),
    totalFee: integer("total_fee"),
    latestPaymentId: uuid("latest_payment_id"),
    referenceCode: varchar("reference_code", { length: 32 }),
    certificateNumber: varchar("certificate_number", { length: 40 }),
    issuedAt: timestamp("issued_at", { mode: "date", withTimezone: true }),
    validUntil: timestamp("valid_until", { mode: "date", withTimezone: true }),
    abandonedAt: timestamp("abandoned_at", { mode: "date", withTimezone: true }),
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
      "bnrs_certificate_issuance_complete",
      sql`(${table.certificateNumber} is null and ${table.validUntil} is null) or (${table.certificateNumber} is not null and ${table.validUntil} is not null and ${table.state} = 'COMPLETED')`,
    ),
    index("bnrs_applications_user_history").on(table.egovUserId, table.createdAt),
  ],
);

export const bnrsOwnerInformation = pgTable("bnrs_owner_information", {
  applicationId: uuid("application_id")
    .primaryKey()
    .references(() => bnrsApplications.id, { onDelete: "cascade" }),
  citizenship: text("citizenship"),
  firstName: text("first_name"),
  middleName: text("middle_name"),
  lastName: text("last_name"),
  suffix: text("suffix"),
  birthDate: date("birth_date", { mode: "string" }),
  gender: text("gender"),
  ...timestamps,
});

export const bnrsBusinessAddresses = pgTable("bnrs_business_addresses", {
  applicationId: uuid("application_id")
    .primaryKey()
    .references(() => bnrsApplications.id, { onDelete: "cascade" }),
  source: bnrsBusinessAddressSourceEnum("source").notNull(),
  addressLine1: text("address_line_1").notNull(),
  addressLine2: text("address_line_2"),
  barangay: text("barangay").notNull(),
  cityMunicipality: text("city_municipality").notNull(),
  province: text("province").notNull(),
  region: text("region").notNull(),
  postalCode: varchar("postal_code", { length: 10 }).notNull(),
  ...timestamps,
});

export const bnrsPayments = pgTable(
  "bnrs_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => bnrsApplications.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 40 }).default("EGOVPAY").notNull(),
    status: bnrsPaymentStatusEnum("status").default("CREATING").notNull(),
    transactionId: varchar("transaction_id", { length: 150 }).notNull(),
    transactionUuid: uuid("transaction_uuid"),
    checkoutUrl: text("checkout_url"),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).default("PHP").notNull(),
    providerStatus: text("provider_status"),
    paidAt: timestamp("paid_at", { mode: "date", withTimezone: true }),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("bnrs_one_pending_payment_per_application")
      .on(table.applicationId)
      .where(sql`${table.status} in ('CREATING', 'PENDING')`),
    uniqueIndex("bnrs_payment_transaction_uuid_unique").on(table.transactionUuid),
    uniqueIndex("bnrs_payment_transaction_id_unique").on(table.transactionId),
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
