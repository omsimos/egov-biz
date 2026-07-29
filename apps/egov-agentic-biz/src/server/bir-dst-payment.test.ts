import { describe, expect, test } from "bun:test";
import {
  BIR_DOCUMENTARY_STAMP_TAX_AMOUNT,
  BIR_DOCUMENTARY_STAMP_TAX_LABEL,
  BirDstPaymentError,
  verifyBirDstProviderTransaction,
} from "@/server/bir-dst-payment";

const payment = {
  amount: BIR_DOCUMENTARY_STAMP_TAX_AMOUNT,
  transactionId: "BIR-DST-transaction",
  transactionUuid: "d147c219-2056-4c85-a17d-a0cd7c85b920",
};

const transaction = {
  amount: "30.00",
  currency: "PHP",
  items: [{ amount: "30.00", name: BIR_DOCUMENTARY_STAMP_TAX_LABEL }],
  txnid: payment.transactionId,
  uuid: payment.transactionUuid,
};

describe("verifyBirDstProviderTransaction", () => {
  test("accepts the authoritative ₱30 DST transaction", () => {
    expect(() => verifyBirDstProviderTransaction(payment, transaction)).not.toThrow();
  });

  test("rejects a provider transaction with altered immutable fields", () => {
    try {
      verifyBirDstProviderTransaction(payment, { ...transaction, amount: "29.00" });
      throw new Error("Expected the altered payment to be rejected.");
    } catch (error) {
      expect(error).toBeInstanceOf(BirDstPaymentError);
      expect((error as BirDstPaymentError).code).toBe("PAYMENT_MISMATCH");
    }
  });
});
