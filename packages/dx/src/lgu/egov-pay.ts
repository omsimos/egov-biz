import type { EgovPayClient } from "@repo/egov/eGovPay/types";

import type {
  LguPaymentProvider,
  LguPaymentProviderSnapshot,
  LguPaymentProviderStatus,
} from "./types.js";

export function normalizeEgovPayLguPaymentStatus(status: string): LguPaymentProviderStatus {
  switch (status.trim().toLowerCase()) {
    case "paid":
    case "success":
    case "successful":
    case "completed":
      return "PAID";
    case "failed":
    case "rejected":
    case "declined":
      return "FAILED";
    case "expired":
      return "EXPIRED";
    case "void":
    case "voided":
    case "canceled":
    case "cancelled":
      return "VOIDED";
    default:
      return "PENDING";
  }
}

function optionalDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function createEgovPayLguPaymentProvider(client: EgovPayClient): LguPaymentProvider {
  return {
    async createPayment(input) {
      const response = await client.generatePayment({
        transactionId: input.transactionId,
        amount: input.amount,
        currency: input.currency,
        callbackUrl: input.callbackUrl,
        redirectUrl: input.redirectUrl,
        items: input.items.map((item) => ({ ...item })),
        description: { ...input.description },
      });
      return {
        transactionUuid: response.data.uuid,
        transactionId: input.transactionId,
        checkoutUrl: response.data.url,
        status: "PENDING",
        amount: input.amount,
        currency: input.currency,
      };
    },
    async getTransaction(transactionUuid): Promise<LguPaymentProviderSnapshot> {
      const { data } = await client.getTransaction(transactionUuid);
      const amount = Number(data.amount);
      if (!Number.isFinite(amount)) throw new Error("eGovPay returned an invalid amount.");
      return {
        transactionUuid: data.uuid,
        transactionId: data.txnid,
        amount,
        currency: data.currency,
        status: normalizeEgovPayLguPaymentStatus(data.payment_status),
        providerStatus: data.payment_status,
        paidAt: optionalDate(data.paid_at),
        expiresAt: optionalDate(data.expires_at),
      };
    },
    async voidTransaction(transactionUuid) {
      await client.voidTransaction(transactionUuid);
    },
  };
}
