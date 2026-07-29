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

const applicationStates = ["PAYMENT_READY", "PAYMENT_PENDING", "COMPLETED", "ABANDONED"] as const;
const territorialScopes = ["CITY_MUNICIPALITY", "REGIONAL", "NATIONAL"] as const;
const paymentStatuses = ["CREATING", "PENDING", "PAID", "FAILED", "EXPIRED", "VOIDED"] as const;

export const lguApplications = sqliteTable(
  "lgu_applications",
  {
    id: text("id").$defaultFn(randomUUID).primaryKey(),
    egovUserId: text("egov_user_id").notNull(),
    state: text("state", { enum: applicationStates }).default("PAYMENT_READY").notNull(),
    city: text("city").notNull(),
    normalizedCity: text("normalized_city").notNull(),
    businessAddressLine1: text("business_address_line_1").notNull(),
    businessAddressLine2: text("business_address_line_2"),
    businessBarangay: text("business_barangay").notNull(),
    businessProvince: text("business_province").notNull(),
    businessRegion: text("business_region").notNull(),
    businessPostalCode: text("business_postal_code").notNull(),
    certificateNumber: text("certificate_number").notNull(),
    certificateIssuingAgency: text("certificate_issuing_agency").notNull(),
    certificateStatus: text("certificate_status").notNull(),
    certificateBusinessName: text("certificate_business_name").notNull(),
    certificateOwnerName: text("certificate_owner_name").notNull(),
    certificateDescriptor: text("certificate_descriptor").notNull(),
    certificateTerritorialScope: text("certificate_territorial_scope", {
      enum: territorialScopes,
    }).notNull(),
    certificateIssuedAt: integer("certificate_issued_at", { mode: "timestamp_ms" }).notNull(),
    certificateValidUntil: integer("certificate_valid_until", {
      mode: "timestamp_ms",
    }).notNull(),
    latestPaymentId: text("latest_payment_id"),
    permitNumber: text("permit_number"),
    barangayClearanceNumber: text("barangay_clearance_number"),
    documentsIssuedAt: integer("documents_issued_at", { mode: "timestamp_ms" }),
    documentsValidUntil: integer("documents_valid_until", { mode: "timestamp_ms" }),
    abandonedAt: integer("abandoned_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("lgu_one_application_per_business_city")
      .on(table.egovUserId, table.certificateNumber, table.normalizedCity)
      .where(sql`${table.state} <> 'ABANDONED'`),
    uniqueIndex("lgu_permit_number_unique")
      .on(table.permitNumber)
      .where(sql`${table.permitNumber} is not null`),
    uniqueIndex("lgu_barangay_clearance_number_unique")
      .on(table.barangayClearanceNumber)
      .where(sql`${table.barangayClearanceNumber} is not null`),
    check(
      "lgu_application_state_valid",
      sql`${table.state} in ('PAYMENT_READY', 'PAYMENT_PENDING', 'COMPLETED', 'ABANDONED')`,
    ),
    check(
      "lgu_certificate_dates_valid",
      sql`${table.certificateIssuedAt} <= ${table.certificateValidUntil}`,
    ),
    check(
      "lgu_certificate_credential_supported",
      sql`${table.certificateIssuingAgency} = 'DTI-BNRS' and ${table.certificateStatus} = 'REGISTERED'`,
    ),
    check(
      "lgu_certificate_scope_valid",
      sql`${table.certificateTerritorialScope} in ('CITY_MUNICIPALITY', 'REGIONAL', 'NATIONAL')`,
    ),
    check(
      "lgu_issued_documents_complete",
      sql`(${table.state} = 'COMPLETED' and ${table.permitNumber} is not null and ${table.barangayClearanceNumber} is not null and ${table.documentsIssuedAt} is not null and ${table.documentsValidUntil} is not null) or (${table.state} <> 'COMPLETED' and ${table.permitNumber} is null and ${table.barangayClearanceNumber} is null and ${table.documentsIssuedAt} is null and ${table.documentsValidUntil} is null)`,
    ),
    index("lgu_applications_user_history").on(table.egovUserId, table.createdAt),
  ],
);

export const lguApplicantInformation = sqliteTable("lgu_applicant_information", {
  applicationId: text("application_id")
    .primaryKey()
    .references(() => lguApplications.id, { onDelete: "cascade" }),
  ownerName: text("owner_name").notNull(),
  normalizedOwnerName: text("normalized_owner_name").notNull(),
  tin: text("tin"),
  ...timestamps,
});

export const lguPayments = sqliteTable(
  "lgu_payments",
  {
    id: text("id").$defaultFn(randomUUID).primaryKey(),
    applicationId: text("application_id")
      .notNull()
      .references(() => lguApplications.id, { onDelete: "cascade" }),
    provider: text("provider").default("EGOVPAY").notNull(),
    status: text("status", { enum: paymentStatuses }).default("CREATING").notNull(),
    transactionId: text("transaction_id").notNull(),
    transactionUuid: text("transaction_uuid"),
    checkoutUrl: text("checkout_url"),
    providerCallbackUrl: text("provider_callback_url").notNull(),
    providerRedirectUrl: text("provider_redirect_url").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").default("PHP").notNull(),
    providerStatus: text("provider_status"),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("lgu_one_pending_payment_per_application")
      .on(table.applicationId)
      .where(sql`${table.status} in ('CREATING', 'PENDING')`),
    uniqueIndex("lgu_payment_transaction_uuid_unique").on(table.transactionUuid),
    uniqueIndex("lgu_payment_transaction_id_unique").on(table.transactionId),
    check(
      "lgu_payment_status_valid",
      sql`${table.status} in ('CREATING', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'VOIDED')`,
    ),
    check(
      "lgu_payment_assessment_fixed",
      sql`${table.amount} = 2500 and ${table.currency} = 'PHP'`,
    ),
    check(
      "lgu_payment_provider_state_complete",
      sql`(${table.status} = 'CREATING' and ${table.transactionUuid} is null and ${table.paidAt} is null) or (${table.status} <> 'CREATING' and ${table.transactionUuid} is not null and ${table.providerStatus} is not null and ((${table.status} = 'PAID' and ${table.paidAt} is not null) or (${table.status} <> 'PAID' and ${table.paidAt} is null)))`,
    ),
    index("lgu_payments_application_history").on(table.applicationId, table.createdAt),
  ],
);

export const lguApplicationsRelations = relations(lguApplications, ({ many, one }) => ({
  applicantInformation: one(lguApplicantInformation, {
    fields: [lguApplications.id],
    references: [lguApplicantInformation.applicationId],
  }),
  payments: many(lguPayments),
}));

export const lguApplicantInformationRelations = relations(lguApplicantInformation, ({ one }) => ({
  application: one(lguApplications, {
    fields: [lguApplicantInformation.applicationId],
    references: [lguApplications.id],
  }),
}));

export const lguPaymentsRelations = relations(lguPayments, ({ one }) => ({
  application: one(lguApplications, {
    fields: [lguPayments.applicationId],
    references: [lguApplications.id],
  }),
}));

export type LguApplicationRow = typeof lguApplications.$inferSelect;
export type NewLguApplicationRow = typeof lguApplications.$inferInsert;
export type LguApplicantInformationRow = typeof lguApplicantInformation.$inferSelect;
export type NewLguApplicantInformationRow = typeof lguApplicantInformation.$inferInsert;
export type LguPaymentRow = typeof lguPayments.$inferSelect;
export type NewLguPaymentRow = typeof lguPayments.$inferInsert;
