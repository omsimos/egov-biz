import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { UIMessage } from "ai";
import type { PaymentServiceType } from "@/lib/business-chat";
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
    activeStreamId: text("active_stream_id"),
    createdAt: isoTimestamp("created_at"),
    updatedAt: isoTimestamp("updated_at"),
  },
  (table) => [index("idx_conversations_updated").on(table.updatedAt)],
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
  messages: many(messages),
  payments: many(payments),
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
