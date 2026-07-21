import { randomUUID } from "node:crypto";
import { getDatabase } from "@/server/db";
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

export type PaymentServiceType = "dti-business-name" | "barangay-clearance" | "ebpls-business-permit";

type PaymentRow = {
  id: string;
  conversation_id: string;
  transaction_uuid: string;
  transaction_id: string;
  amount: number;
  status: string;
  proposed_name: string;
  territorial_scope: string;
  owner_name: string;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  service_type: PaymentServiceType;
  service_reference: string | null;
};

function mapPayment(row: PaymentRow): StoredPayment {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    transactionUuid: row.transaction_uuid,
    transactionId: row.transaction_id,
    amount: row.amount,
    status: row.status,
    proposedName: row.proposed_name,
    territorialScope: row.territorial_scope,
    ownerName: row.owner_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidAt: row.paid_at,
    serviceType: row.service_type,
    serviceReference: row.service_reference,
  };
}

export function getLatestPaymentForService(conversationId: string, serviceType: PaymentServiceType) {
  const row = getDatabase().prepare("SELECT * FROM payments WHERE conversation_id = ? AND service_type = ? ORDER BY created_at DESC, rowid DESC LIMIT 1").get(conversationId, serviceType) as PaymentRow | undefined;
  return row ? mapPayment(row) : null;
}

export function isPaidStatus(status: string) {
  return /^(paid|success|successful|completed|complete)$/i.test(status.trim());
}

export function createPayment(input: Omit<StoredPayment, "id" | "createdAt" | "updatedAt" | "paidAt">) {
  const now = new Date().toISOString();
  getDatabase().prepare(`
    INSERT INTO payments (
      id, conversation_id, transaction_uuid, transaction_id, amount, status,
      proposed_name, territorial_scope, owner_name, created_at, updated_at, paid_at
      , service_type, service_reference
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
  `).run(
    randomUUID(), input.conversationId, input.transactionUuid, input.transactionId, input.amount, input.status,
    input.proposedName, input.territorialScope, input.ownerName, now, now, input.serviceType, input.serviceReference,
  );
  return getPaymentByTransactionId(input.transactionId)!;
}

export function getPaymentByTransactionId(transactionId: string) {
  const row = getDatabase().prepare("SELECT * FROM payments WHERE transaction_id = ?").get(transactionId) as PaymentRow | undefined;
  return row ? mapPayment(row) : null;
}

export function getPaymentByUuid(transactionUuid: string) {
  const row = getDatabase().prepare("SELECT * FROM payments WHERE transaction_uuid = ?").get(transactionUuid) as PaymentRow | undefined;
  return row ? mapPayment(row) : null;
}

export function getLatestPaymentForConversation(conversationId: string) {
  const row = getDatabase().prepare("SELECT * FROM payments WHERE conversation_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1").get(conversationId) as PaymentRow | undefined;
  return row ? mapPayment(row) : null;
}

export function updatePaymentStatus(transactionUuid: string, status: string, paidAt?: string | null) {
  const payment = getPaymentByUuid(transactionUuid);
  if (!payment) return null;
  const paid = isPaidStatus(status);
  getDatabase().prepare("UPDATE payments SET status = ?, paid_at = ?, updated_at = ? WHERE transaction_uuid = ?")
    .run(status, paid ? (paidAt || new Date().toISOString()) : payment.paidAt, new Date().toISOString(), transactionUuid);
  if (paid && payment.serviceType === "dti-business-name") markPaymentCheckpointComplete(payment.conversationId);
  return getPaymentByUuid(transactionUuid);
}
