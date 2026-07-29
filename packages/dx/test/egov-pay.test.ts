import { describe, expect, test } from "bun:test";
import type { EgovPayTransaction } from "egov.js";
import type { EgovPayClient, EgovPayGeneratePaymentRequest } from "../src/egov-pay.js";

import {
  createEgovPayBnrsPaymentProvider,
  normalizeEgovPayPaymentStatus,
} from "../src/bnrs/index.js";

function transaction(paymentStatus: string): EgovPayTransaction {
  return {
    amount: "530.00",
    callback_url: "https://app.example.test/callback",
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
    redirect_url: "https://app.example.test/return",
    refno: "reference",
    system_fee: "0.00",
    txnid: "BNRS-PAY-1",
    uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  };
}

describe("BNRS eGovPay adapter", () => {
  test("maps checkout requests and provider responses", async () => {
    const generated: EgovPayGeneratePaymentRequest[] = [];
    const voided: string[] = [];
    const client: EgovPayClient = {
      async generatePayment(request) {
        generated.push(request);
        return {
          data: {
            channel: { refno: "reference" },
            url: "https://pay.example.test/checkout",
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
    const provider = createEgovPayBnrsPaymentProvider(client);

    const checkout = await provider.createPayment({
      transactionId: "BNRS-PAY-1",
      amount: 530,
      currency: "PHP",
      callbackUrl: "https://app.example.test/callback",
      redirectUrl: "https://app.example.test/return",
      items: [
        { name: "DTI Business Name Registration — City / Municipality", amount: 500 },
        { name: "Documentary Stamp Tax", amount: 30 },
      ],
      description: { applicationId: "application-1" },
    });
    const snapshot = await provider.getTransaction(checkout.transactionUuid);
    await provider.voidTransaction(checkout.transactionUuid);

    expect(generated[0]).toMatchObject({
      amount: 530,
      currency: "PHP",
      transactionId: "BNRS-PAY-1",
      items: [
        { name: "DTI Business Name Registration — City / Municipality", amount: 500 },
        { name: "Documentary Stamp Tax", amount: 30 },
      ],
    });
    expect(checkout).toEqual({
      transactionUuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      transactionId: "BNRS-PAY-1",
      checkoutUrl: "https://pay.example.test/checkout",
      status: "PENDING",
      amount: 530,
      currency: "PHP",
    });
    expect(snapshot).toMatchObject({
      status: "PAID",
      amount: 530,
      paidAt: new Date("2026-07-29T08:30:00.000Z"),
    });
    expect(voided).toEqual([checkout.transactionUuid]);
  });

  test("normalizes known terminal statuses and treats unknown statuses as pending", () => {
    expect(normalizeEgovPayPaymentStatus("success")).toBe("PAID");
    expect(normalizeEgovPayPaymentStatus("FAILED")).toBe("FAILED");
    expect(normalizeEgovPayPaymentStatus("expired")).toBe("EXPIRED");
    expect(normalizeEgovPayPaymentStatus("cancelled")).toBe("VOIDED");
    expect(normalizeEgovPayPaymentStatus("awaiting_bank")).toBe("PENDING");
  });
});
