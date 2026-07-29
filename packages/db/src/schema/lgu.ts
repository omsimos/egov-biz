import { relations, sql } from "drizzle-orm";
import {
  check,
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

export const lguApplicationStateEnum = pgEnum("lgu_application_state", [
  "PAYMENT_READY",
  "PAYMENT_PENDING",
  "COMPLETED",
  "ABANDONED",
]);

export const lguTerritorialScopeEnum = pgEnum("lgu_territorial_scope", [
  "CITY_MUNICIPALITY",
  "REGIONAL",
  "NATIONAL",
]);

export const lguPaymentStatusEnum = pgEnum("lgu_payment_status", [
  "CREATING",
  "PENDING",
  "PAID",
  "FAILED",
  "EXPIRED",
  "VOIDED",
]);

export const lguApplications = pgTable(
  "lgu_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    egovUserId: text("egov_user_id").notNull(),
    state: lguApplicationStateEnum("state").default("PAYMENT_READY").notNull(),
    city: text("city").notNull(),
    normalizedCity: text("normalized_city").notNull(),
    certificateNumber: varchar("certificate_number", { length: 40 }).notNull(),
    certificateIssuingAgency: varchar("certificate_issuing_agency", { length: 40 }).notNull(),
    certificateStatus: varchar("certificate_status", { length: 20 }).notNull(),
    certificateBusinessName: text("certificate_business_name").notNull(),
    certificateOwnerName: text("certificate_owner_name").notNull(),
    certificateDescriptor: text("certificate_descriptor").notNull(),
    certificateTerritorialScope: lguTerritorialScopeEnum("certificate_territorial_scope").notNull(),
    certificateIssuedAt: timestamp("certificate_issued_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    certificateValidUntil: timestamp("certificate_valid_until", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    latestPaymentId: uuid("latest_payment_id"),
    permitNumber: varchar("permit_number", { length: 40 }),
    barangayClearanceNumber: varchar("barangay_clearance_number", { length: 40 }),
    documentsIssuedAt: timestamp("documents_issued_at", { mode: "date", withTimezone: true }),
    documentsValidUntil: timestamp("documents_valid_until", {
      mode: "date",
      withTimezone: true,
    }),
    abandonedAt: timestamp("abandoned_at", { mode: "date", withTimezone: true }),
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
      "lgu_certificate_dates_valid",
      sql`${table.certificateIssuedAt} <= ${table.certificateValidUntil}`,
    ),
    check(
      "lgu_certificate_credential_supported",
      sql`${table.certificateIssuingAgency} = 'DTI-BNRS' and ${table.certificateStatus} = 'REGISTERED'`,
    ),
    check(
      "lgu_issued_documents_complete",
      sql`(${table.state} = 'COMPLETED' and ${table.permitNumber} is not null and ${table.barangayClearanceNumber} is not null and ${table.documentsIssuedAt} is not null and ${table.documentsValidUntil} is not null) or (${table.state} <> 'COMPLETED' and ${table.permitNumber} is null and ${table.barangayClearanceNumber} is null and ${table.documentsIssuedAt} is null and ${table.documentsValidUntil} is null)`,
    ),
    index("lgu_applications_user_history").on(table.egovUserId, table.createdAt),
  ],
);

export const lguApplicantInformation = pgTable("lgu_applicant_information", {
  applicationId: uuid("application_id")
    .primaryKey()
    .references(() => lguApplications.id, { onDelete: "cascade" }),
  ownerName: text("owner_name").notNull(),
  normalizedOwnerName: text("normalized_owner_name").notNull(),
  tin: varchar("tin", { length: 14 }),
  ...timestamps,
});

export const lguPayments = pgTable(
  "lgu_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => lguApplications.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 40 }).default("EGOVPAY").notNull(),
    status: lguPaymentStatusEnum("status").default("CREATING").notNull(),
    transactionId: varchar("transaction_id", { length: 150 }).notNull(),
    transactionUuid: uuid("transaction_uuid"),
    checkoutUrl: text("checkout_url"),
    providerCallbackUrl: text("provider_callback_url").notNull(),
    providerRedirectUrl: text("provider_redirect_url").notNull(),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).default("PHP").notNull(),
    providerStatus: text("provider_status"),
    paidAt: timestamp("paid_at", { mode: "date", withTimezone: true }),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("lgu_one_pending_payment_per_application")
      .on(table.applicationId)
      .where(sql`${table.status} in ('CREATING', 'PENDING')`),
    uniqueIndex("lgu_payment_transaction_uuid_unique").on(table.transactionUuid),
    uniqueIndex("lgu_payment_transaction_id_unique").on(table.transactionId),
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
