import { describe, expect, test } from "bun:test";
import type {
  EgovPayClient,
  EgovPayGeneratePaymentRequest,
  EgovPayTransaction,
} from "@repo/egov/eGovPay/types";

import {
  createEgovPayLguPaymentProvider,
  normalizeEgovPayLguPaymentStatus,
} from "../src/lgu/index.js";

function transaction(paymentStatus: string): EgovPayTransaction {
  return {
    amount: "2500.00",
    callback_url: "https://app.example.test/lgu/callback",
    channel_fee: "0.00",
    created_at: "2026-07-29T08:00:00.000Z",
    currency: "PHP",
    environment_type: "staging",
    expires_at: "2026-07-30T08:00:00.000Z",
    items: [],
    link_expires_at: "2026-07-30T08:00:00.000Z",
    paid_at: paymentStatus === "paid" ? "2026-07-29T08:30:00.000Z" : null,
    partner_fee: "0.00",
    payment_channel: null,
    payment_channel_branch: null,
    payment_channel_uuid: null,
    payment_status: paymentStatus,
    redirect_url: "https://app.example.test/lgu/return",
    refno: "lgu-reference",
    system_fee: "0.00",
    txnid: "LGU-PAY-1",
    uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  };
}

describe("LGU eGovPay adapter", () => {
  test("maps the LGU checkout independently from BNRS", async () => {
    const generated: EgovPayGeneratePaymentRequest[] = [];
    const voided: string[] = [];
    const client: EgovPayClient = {
      async generatePayment(request) {
        generated.push(request);
        return {
          data: {
            channel: { refno: "lgu-reference" },
            url: "https://pay.example.test/lgu-checkout",
            uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          },
        };
      },
      async getTransaction() {
        return { data: transaction("paid") };
      },
      async voidTransaction(transactionUuid) {
        voided.push(transactionUuid);
        return { data: { message: "voided" } };
      },
    };
    const provider = createEgovPayLguPaymentProvider(client);

    const checkout = await provider.createPayment({
      transactionId: "LGU-PAY-1",
      amount: 2_500,
      currency: "PHP",
      callbackUrl: "https://app.example.test/lgu/callback",
      redirectUrl: "https://app.example.test/lgu/return",
      items: [{ name: "LGU Business Permit — Makati City", amount: 2_500 }],
      description: { applicationId: "application-1", includesBarangayClearance: true },
    });
    const snapshot = await provider.getTransaction(checkout.transactionUuid);
    await provider.voidTransaction(checkout.transactionUuid);

    expect(generated[0]).toMatchObject({
      amount: 2_500,
      currency: "PHP",
      transactionId: "LGU-PAY-1",
      items: [{ name: "LGU Business Permit — Makati City", amount: 2_500 }],
    });
    expect(checkout).toEqual({
      transactionUuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      transactionId: "LGU-PAY-1",
      checkoutUrl: "https://pay.example.test/lgu-checkout",
      status: "PENDING",
      amount: 2_500,
      currency: "PHP",
    });
    expect(snapshot).toMatchObject({
      status: "PAID",
      amount: 2_500,
      paidAt: new Date("2026-07-29T08:30:00.000Z"),
    });
    expect(voided).toEqual([checkout.transactionUuid]);
  });

  test("normalizes provider terminal statuses", () => {
    expect(normalizeEgovPayLguPaymentStatus("success")).toBe("PAID");
    expect(normalizeEgovPayLguPaymentStatus("FAILED")).toBe("FAILED");
    expect(normalizeEgovPayLguPaymentStatus("expired")).toBe("EXPIRED");
    expect(normalizeEgovPayLguPaymentStatus("cancelled")).toBe("VOIDED");
    expect(normalizeEgovPayLguPaymentStatus("awaiting_bank")).toBe("PENDING");
  });
});
