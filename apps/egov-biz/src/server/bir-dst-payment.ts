import { createEgovPayClient } from "@repo/dx";
import { createClient, type EgovPayTransaction } from "egov.js";
import { egovPayBaseUrl } from "@/lib/payment-urls";
import {
  createPayment,
  getLatestPaymentForService,
  getPaymentByUuid,
  isPaidStatus,
  type StoredPayment,
  updatePaymentStatus,
} from "@/server/payments";

export const BIR_DOCUMENTARY_STAMP_TAX_AMOUNT = 30;
export const BIR_DOCUMENTARY_STAMP_TAX_LABEL = "BIR Documentary Stamp Tax";
export const BIR_DOCUMENTARY_STAMP_TAX_SERVICE = "bir-documentary-stamp-tax" as const;

type BirDstPaymentReference = {
  artifactId: string;
  checkoutUrl: string;
};

export class BirDstPaymentError extends Error {
  constructor(
    readonly code:
      | "FORM_NOT_FOUND"
      | "PAYMENT_ALREADY_PAID"
      | "PAYMENT_MISMATCH"
      | "PAYMENT_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "BirDstPaymentError";
  }
}

function paymentClient() {
  const baseUrl = egovPayBaseUrl();
  const apiKey = process.env.EGOVPAY_API_KEY?.trim();
  const settlementTemplateUuid = process.env.EGOVPAY_SETTLEMENT_TEMPLATE_UUID?.trim();
  if (!apiKey || !settlementTemplateUuid)
    throw new Error("eGovPay credentials are required for BIR payment operations.");
  return {
    baseUrl,
    client: createEgovPayClient({
      apiKey,
      client: createClient({ baseUrl }),
      settlementTemplateUuid,
    }),
  };
}

function providerSignal() {
  return AbortSignal.timeout(12_000);
}

function encodeReference(reference: BirDstPaymentReference) {
  return JSON.stringify(reference);
}

function decodeReference(value: string | null): BirDstPaymentReference | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<BirDstPaymentReference>;
    return typeof parsed.artifactId === "string" && typeof parsed.checkoutUrl === "string"
      ? { artifactId: parsed.artifactId, checkoutUrl: parsed.checkoutUrl }
      : null;
  } catch {
    return null;
  }
}

function providerAmount(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export function verifyBirDstProviderTransaction(
  payment: Pick<StoredPayment, "amount" | "transactionId" | "transactionUuid">,
  transaction: Pick<EgovPayTransaction, "amount" | "currency" | "items" | "txnid" | "uuid">,
) {
  const dstItem = transaction.items.find(
    (item) =>
      item.name === BIR_DOCUMENTARY_STAMP_TAX_LABEL &&
      providerAmount(item.amount) === BIR_DOCUMENTARY_STAMP_TAX_AMOUNT,
  );
  if (
    payment.amount !== BIR_DOCUMENTARY_STAMP_TAX_AMOUNT ||
    transaction.uuid !== payment.transactionUuid ||
    transaction.txnid !== payment.transactionId ||
    providerAmount(transaction.amount) !== payment.amount ||
    transaction.currency.toUpperCase() !== "PHP" ||
    !dstItem
  )
    throw new BirDstPaymentError(
      "PAYMENT_MISMATCH",
      "The eGovPay transaction does not match this BIR documentary stamp tax payment.",
    );
}

async function syncStoredPayment(payment: StoredPayment) {
  if (isPaidStatus(payment.status)) return payment;
  const { client } = paymentClient();
  const { data } = await client.getTransaction(payment.transactionUuid, {
    signal: providerSignal(),
  });
  verifyBirDstProviderTransaction(payment, data);
  return (
    (await updatePaymentStatus(payment.transactionUuid, data.payment_status, data.paid_at)) ??
    payment
  );
}

export async function createBirDstCheckout(input: {
  artifactId: string;
  callbackUrl: string;
  conversationId: string;
  email?: string;
  mobile?: string;
  redirectUrl: string;
  taxpayerName: string;
}) {
  const existing = await getLatestPaymentForService(
    input.conversationId,
    BIR_DOCUMENTARY_STAMP_TAX_SERVICE,
  );
  if (existing) {
    const current = await syncStoredPayment(existing);
    if (isPaidStatus(current.status))
      throw new BirDstPaymentError(
        "PAYMENT_ALREADY_PAID",
        "The BIR documentary stamp tax has already been paid.",
      );
    const savedReference = decodeReference(current.serviceReference);
    if (savedReference?.checkoutUrl && !/expired|failed|voided|cancelled/i.test(current.status))
      return {
        amount: current.amount,
        checkoutUrl: savedReference.checkoutUrl,
        payment: current,
        transactionId: current.transactionId,
        transactionUuid: current.transactionUuid,
      };
  }

  const transactionId = `BIR-DST-${crypto.randomUUID()}`;
  const { client } = paymentClient();
  const response = await client.generatePayment(
    {
      amount: BIR_DOCUMENTARY_STAMP_TAX_AMOUNT,
      callbackUrl: input.callbackUrl,
      currency: "PHP",
      description: {
        artifactId: input.artifactId,
        service: BIR_DOCUMENTARY_STAMP_TAX_LABEL,
      },
      email: input.email,
      items: [
        {
          amount: BIR_DOCUMENTARY_STAMP_TAX_AMOUNT,
          name: BIR_DOCUMENTARY_STAMP_TAX_LABEL,
        },
      ],
      mobile: input.mobile,
      name: input.taxpayerName,
      redirectUrl: input.redirectUrl,
      transactionId,
    },
    { signal: providerSignal() },
  );
  const payment = await createPayment({
    amount: BIR_DOCUMENTARY_STAMP_TAX_AMOUNT,
    conversationId: input.conversationId,
    ownerName: input.taxpayerName,
    proposedName: "BIR Form 1901",
    serviceReference: encodeReference({
      artifactId: input.artifactId,
      checkoutUrl: response.data.url,
    }),
    serviceType: BIR_DOCUMENTARY_STAMP_TAX_SERVICE,
    status: "pending",
    territorialScope: "Not applicable",
    transactionId,
    transactionUuid: response.data.uuid,
  });
  return {
    amount: payment.amount,
    checkoutUrl: response.data.url,
    payment,
    transactionId,
    transactionUuid: response.data.uuid,
  };
}

export async function syncBirDstPaymentForConversation(conversationId: string) {
  const payment = await getLatestPaymentForService(
    conversationId,
    BIR_DOCUMENTARY_STAMP_TAX_SERVICE,
  );
  if (!payment) throw new BirDstPaymentError("PAYMENT_NOT_FOUND", "The BIR payment was not found.");
  return syncStoredPayment(payment);
}

export async function syncBirDstPaymentByUuid(transactionUuid: string) {
  const payment = await getPaymentByUuid(transactionUuid);
  if (!payment || payment.serviceType !== BIR_DOCUMENTARY_STAMP_TAX_SERVICE) return null;
  return syncStoredPayment(payment);
}
