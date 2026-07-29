import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDatabase, schema } from "@/server/db";
import { markPaymentCheckpointComplete } from "@/server/conversations";

export type StoredPayment = {
  id: string;
  conversationId: string;
  transactionUuid: string;
  transactionId: string;
  amount: number;
  status: string;
  proposedName: string;
  territorialScope: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  serviceType: PaymentServiceType;
  serviceReference: string | null;
};

export type PaymentServiceType =
  | "dti-business-name"
  | "barangay-clearance"
  | "ebpls-business-permit";

type PaymentRow = typeof schema.payments.$inferSelect;

// Newest first, with rowid breaking ties between rows written in the same
// millisecond.
const newestFirst = [desc(schema.payments.createdAt), sql`rowid desc`] as const;

function mapPayment(row: PaymentRow): StoredPayment {
  return {
    id: row.id,
    conversationId: row.conversationId,
    transactionUuid: row.transactionUuid,
    transactionId: row.transactionId,
    amount: row.amount,
    status: row.status,
    proposedName: row.proposedName,
    territorialScope: row.territorialScope,
    ownerName: row.ownerName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    paidAt: row.paidAt,
    serviceType: row.serviceType,
    serviceReference: row.serviceReference,
  };
}

export async function getLatestPaymentForService(
  conversationId: string,
  serviceType: PaymentServiceType,
) {
  const database = await getDatabase();
  const [row] = await database
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.conversationId, conversationId),
        eq(schema.payments.serviceType, serviceType),
      ),
    )
    .orderBy(...newestFirst)
    .limit(1);
  return row ? mapPayment(row) : null;
}

export function isPaidStatus(status: string) {
  return /^(paid|success|successful|completed|complete)$/i.test(status.trim());
}

export async function createPayment(
  input: Omit<StoredPayment, "id" | "createdAt" | "updatedAt" | "paidAt">,
) {
  const now = new Date().toISOString();
  const database = await getDatabase();
  const [row] = await database
    .insert(schema.payments)
    .values({
      amount: input.amount,
      conversationId: input.conversationId,
      createdAt: now,
      id: randomUUID(),
      ownerName: input.ownerName,
      paidAt: null,
      proposedName: input.proposedName,
      serviceReference: input.serviceReference,
      serviceType: input.serviceType,
      status: input.status,
      territorialScope: input.territorialScope,
      transactionId: input.transactionId,
      transactionUuid: input.transactionUuid,
      updatedAt: now,
    })
    .returning();
  return mapPayment(row!);
}

export async function getPaymentByTransactionId(transactionId: string) {
  const database = await getDatabase();
  const [row] = await database
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.transactionId, transactionId))
    .limit(1);
  return row ? mapPayment(row) : null;
}

export async function getPaymentByUuid(transactionUuid: string) {
  const database = await getDatabase();
  const [row] = await database
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.transactionUuid, transactionUuid))
    .limit(1);
  return row ? mapPayment(row) : null;
}

export async function getLatestPaymentForConversation(conversationId: string) {
  const database = await getDatabase();
  const [row] = await database
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.conversationId, conversationId))
    .orderBy(...newestFirst)
    .limit(1);
  return row ? mapPayment(row) : null;
}

export async function updatePaymentStatus(
  transactionUuid: string,
  status: string,
  paidAt?: string | null,
) {
  const payment = await getPaymentByUuid(transactionUuid);
  if (!payment) return null;
  const paid = isPaidStatus(status);
  const database = await getDatabase();
  const [updated] = await database
    .update(schema.payments)
    .set({
      paidAt: paid ? paidAt || new Date().toISOString() : payment.paidAt,
      status,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.payments.transactionUuid, transactionUuid))
    .returning();
  if (paid && payment.serviceType === "dti-business-name")
    await markPaymentCheckpointComplete(payment.conversationId);
  return updated ? mapPayment(updated) : null;
}
