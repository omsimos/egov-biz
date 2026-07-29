import { relations, sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { UIMessage } from "ai";
import type { ConversationPurpose, PaymentServiceType } from "@/lib/business-chat";
import type { RegisteredBusiness } from "@/lib/registered-business";

// Timestamps are ISO-8601 strings rather than SQLite integers so the stored
// values stay readable in `turso db shell` and sort correctly as text.
const isoTimestamp = (name: string) => text(name).notNull();

// The `*_json` columns stay plain text instead of Drizzle's `{ mode: "json" }`.
// Callers parse them behind a try/catch and treat a corrupt row as missing
// rather than as a request failure; automatic parsing would throw during the
// SELECT and take out the whole query instead.

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    initialPrompt: text("initial_prompt").notNull(),
    ownerEgovUserId: text("owner_egov_user_id"),
    purpose: text("purpose").$type<ConversationPurpose>().notNull().default("registration"),
    businessId: text("business_id"),
    bnrsApplicationId: text("bnrs_application_id"),
    bnrsTransactionUuid: text("bnrs_transaction_uuid"),
    bnrsCertificateNumber: text("bnrs_certificate_number"),
    lguApplicationId: text("lgu_application_id"),
    lguTransactionUuid: text("lgu_transaction_uuid"),
    activeStreamId: text("active_stream_id"),
    createdAt: isoTimestamp("created_at"),
    updatedAt: isoTimestamp("updated_at"),
  },
  (table) => [
    index("idx_conversations_updated").on(table.updatedAt),
    index("idx_conversations_owner_updated").on(table.ownerEgovUserId, table.updatedAt),
    uniqueIndex("idx_conversations_bnrs_application").on(table.bnrsApplicationId),
    uniqueIndex("idx_conversations_bnrs_transaction").on(table.bnrsTransactionUuid),
    uniqueIndex("idx_conversations_bnrs_certificate").on(table.bnrsCertificateNumber),
    uniqueIndex("idx_conversations_lgu_application").on(table.lguApplicationId),
    uniqueIndex("idx_conversations_lgu_transaction").on(table.lguTransactionUuid),
    index("idx_conversations_business_updated").on(table.businessId, table.updatedAt),
  ],
);

export const conversationArtifacts = sqliteTable(
  "conversation_artifacts",
  {
    artifactId: text("artifact_id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    ownerEgovUserId: text("owner_egov_user_id").notNull(),
    kind: text("kind").$type<"BIR_FORM_1901" | "BIR_FORM_1905">().notNull(),
    createdAt: isoTimestamp("created_at"),
  },
  (table) => [
    index("idx_conversation_artifacts_conversation_created").on(
      table.conversationId,
      table.createdAt,
    ),
    index("idx_conversation_artifacts_owner_created").on(table.ownerEgovUserId, table.createdAt),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").$type<UIMessage["role"]>().notNull(),
    partsJson: text("parts_json").notNull(),
    createdAt: isoTimestamp("created_at"),
  },
  (table) => [index("idx_messages_conversation_created").on(table.conversationId, table.createdAt)],
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    transactionUuid: text("transaction_uuid").notNull().unique(),
    transactionId: text("transaction_id").notNull().unique(),
    amount: integer("amount").notNull(),
    status: text("status").notNull(),
    proposedName: text("proposed_name").notNull(),
    territorialScope: text("territorial_scope").notNull(),
    ownerName: text("owner_name").notNull(),
    createdAt: isoTimestamp("created_at"),
    updatedAt: isoTimestamp("updated_at"),
    paidAt: text("paid_at"),
    serviceType: text("service_type")
      .$type<PaymentServiceType>()
      .notNull()
      .default("dti-business-name"),
    serviceReference: text("service_reference"),
  },
  (table) => [
    index("idx_payments_conversation_created").on(table.conversationId, table.createdAt),
    index("idx_payments_conversation_service").on(
      table.conversationId,
      table.serviceType,
      table.createdAt,
    ),
  ],
);

export const smsDispatches = sqliteTable(
  "sms_dispatches",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userMessageId: text("user_message_id").notNull(),
    profileId: text("profile_id"),
    recipientHash: text("recipient_hash"),
    toolName: text("tool_name")
      .$type<"send_sms_message" | "simulate_tax_payment_reminder">()
      .notNull(),
    status: text("status").$type<"pending" | "accepted" | "failed">().notNull(),
    outputJson: text("output_json"),
    createdAt: isoTimestamp("created_at"),
    updatedAt: isoTimestamp("updated_at"),
  },
  (table) => [
    index("idx_sms_dispatches_conversation_created").on(table.conversationId, table.createdAt),
    index("idx_sms_dispatches_profile_created").on(table.profileId, table.createdAt),
    index("idx_sms_dispatches_recipient_created").on(table.recipientHash, table.createdAt),
  ],
);

export const smsQuotaBuckets = sqliteTable(
  "sms_quota_buckets",
  {
    id: text("id").primaryKey(),
    count: integer("count").notNull(),
    maxCount: integer("max_count").notNull(),
    expiresAt: isoTimestamp("expires_at"),
    createdAt: isoTimestamp("created_at"),
  },
  (table) => [
    check(
      "sms_quota_count_valid",
      sql`${table.count} >= 1 AND ${table.count} <= ${table.maxCount}`,
    ),
    index("idx_sms_quota_buckets_expires").on(table.expiresAt),
  ],
);

export const registeredBusinesses = sqliteTable(
  "registered_businesses",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull().unique(),
    profileId: text("profile_id").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    category: text("category").$type<RegisteredBusiness["category"]>().notNull(),
    registrationNumber: text("registration_number").notNull(),
    status: text("status").$type<RegisteredBusiness["status"]>().notNull(),
    ownerName: text("owner_name").notNull(),
    businessActivity: text("business_activity").notNull(),
    businessAddress: text("business_address").notNull(),
    city: text("city").notNull(),
    rdo: text("rdo").notNull(),
    tinMasked: text("tin_masked").notNull(),
    recordsJson: text("records_json").notNull(),
    taxObligationsJson: text("tax_obligations_json").notNull(),
    filesJson: text("files_json")
      .notNull()
      .default(sql`'[]'`),
    finalizedAt: isoTimestamp("finalized_at"),
    createdAt: isoTimestamp("created_at"),
    updatedAt: isoTimestamp("updated_at"),
  },
  (table) => [
    index("idx_registered_businesses_profile_updated").on(table.profileId, table.updatedAt),
  ],
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    rawProfileJson: text("raw_profile_json").notNull(),
    // Epoch milliseconds, compared directly against Date.now() by the caller.
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("idx_auth_sessions_expires").on(table.expiresAt)],
);

export const conversationsRelations = relations(conversations, ({ many }) => ({
  artifacts: many(conversationArtifacts),
  messages: many(messages),
  payments: many(payments),
  smsDispatches: many(smsDispatches),
}));

export const conversationArtifactsRelations = relations(conversationArtifacts, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationArtifacts.conversationId],
    references: [conversations.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  conversation: one(conversations, {
    fields: [payments.conversationId],
    references: [conversations.id],
  }),
}));

export const smsDispatchesRelations = relations(smsDispatches, ({ one }) => ({
  conversation: one(conversations, {
    fields: [smsDispatches.conversationId],
    references: [conversations.id],
  }),
}));
