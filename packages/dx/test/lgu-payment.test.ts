import { describe, expect, test } from "bun:test";

import {
  LguError,
  createLguService,
  type LguBusinessRegistrationCredentialInput,
} from "../src/lgu/index.js";
import { FakeLguPaymentProvider } from "./support/fake-lgu-payment-provider.js";
import { MemoryLguRepository } from "./support/memory-lgu-repository.js";

const NOW = new Date("2026-07-29T08:30:00.000Z");
const certificate: LguBusinessRegistrationCredentialInput = {
  certificateNumber: "BN-2026-00001234",
  issuingAgency: "DTI-BNRS",
  businessName: "Molar Bear Dental Clinic",
  ownerName: "Mara Reyes",
  descriptor: "Dental Clinic",
  territorialScope: "CITY_MUNICIPALITY",
  issuedAt: "2026-07-28T08:30:00.000Z",
  validUntil: "2031-07-28T08:30:00.000Z",
  status: "REGISTERED",
};

function setup() {
  const repository = new MemoryLguRepository();
  const paymentProvider = new FakeLguPaymentProvider();
  const generatedIds = [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    "ffffffff-ffff-4fff-8fff-ffffffffffff",
  ];
  const service = createLguService({
    repository,
    paymentProvider,
    now: () => NOW,
    generateId: () => {
      const id = generatedIds.shift();
      if (!id) throw new Error("The test exhausted its deterministic IDs.");
      return id;
    },
  });
  return {
    actor: { egovUserId: "egov-user-1" },
    applicant: { ownerName: "Mara Reyes", tin: "123-456-789-000" },
    paymentProvider,
    repository,
    service,
  };
}

async function prepareApplication(context: ReturnType<typeof setup>, city = "Makati City") {
  return context.service.startOrResumeApplication({
    actor: context.actor,
    applicant: context.applicant,
    certificate,
    city,
  });
}

async function expectLguError(action: () => Promise<unknown>, code: LguError["code"]) {
  try {
    await action();
    throw new Error("Expected an LguError");
  } catch (error) {
    expect(error).toBeInstanceOf(LguError);
    expect((error as LguError).code).toBe(code);
  }
}

describe("LGU hosted payments and issuance", () => {
  test("creates and reuses an independent flat-fee hosted checkout", async () => {
    const context = setup();
    const application = await prepareApplication(context);
    const input = {
      actor: context.actor,
      applicationId: application.applicationId,
      callbackUrl: "https://app.example.test/lgu/callback",
      redirectUrl: "https://app.example.test/lgu/return",
    };

    const created = await context.service.createPayment(input);
    const retried = await context.service.createPayment(input);

    expect(retried).toEqual(created);
    expect(context.paymentProvider.createInputs).toHaveLength(1);
    expect(context.paymentProvider.createInputs[0]).toMatchObject({
      amount: 2_500,
      currency: "PHP",
      items: [{ amount: 2_500, name: "LGU Business Permit — Makati City" }],
      description: {
        applicationId: application.applicationId,
        bnrsCertificateNumber: certificate.certificateNumber,
        includesBarangayClearance: true,
      },
    });
  });

  test("recovers the same logical checkout after a lost provider response", async () => {
    const context = setup();
    const application = await prepareApplication(context);
    const input = {
      actor: context.actor,
      applicationId: application.applicationId,
      callbackUrl: "https://app.example.test/lgu/callback",
      redirectUrl: "https://app.example.test/lgu/return",
    };
    context.paymentProvider.failAfterNextCreation = true;

    await expectLguError(() => context.service.createPayment(input), "PAYMENT_PROVIDER_ERROR");
    const recovered = await context.service.createPayment(input);

    expect(context.paymentProvider.createInputs).toHaveLength(2);
    expect(context.paymentProvider.createInputs[1]?.transactionId).toBe(
      context.paymentProvider.createInputs[0]?.transactionId,
    );
    expect(recovered.transactionId).toBe(context.paymentProvider.createInputs[0]?.transactionId);
  });

  test("recovers and voids a creating attempt before abandonment", async () => {
    const context = setup();
    const application = await prepareApplication(context);
    const input = {
      actor: context.actor,
      applicationId: application.applicationId,
      callbackUrl: "https://app.example.test/lgu/callback",
      redirectUrl: "https://app.example.test/lgu/return",
    };
    context.paymentProvider.failBeforeNextCreation = true;

    await expectLguError(() => context.service.createPayment(input), "PAYMENT_PROVIDER_ERROR");
    const abandoned = await context.service.abandonApplication({
      actor: context.actor,
      applicationId: application.applicationId,
    });

    expect(context.paymentProvider.createInputs).toHaveLength(2);
    expect(context.paymentProvider.createInputs[1]?.transactionId).toBe(
      context.paymentProvider.createInputs[0]?.transactionId,
    );
    expect(context.paymentProvider.voided).toHaveLength(1);
    expect(abandoned.state).toBe("ABANDONED");
  });

  test("attaches a provider callback to a checkout that was still being created", async () => {
    const context = setup();
    const application = await prepareApplication(context);
    const started = await context.repository.beginPayment({
      applicationId: application.applicationId,
      egovUserId: context.actor.egovUserId,
      transactionId: "LGU-PAY-callback-recovery",
      amount: 2_500,
      currency: "PHP",
      providerCallbackUrl: "https://app.example.test/lgu/callback",
      providerRedirectUrl: "https://app.example.test/lgu/return",
      now: NOW,
    });
    if (!started) throw new Error("Expected payment creation to start");
    const checkout = await context.paymentProvider.createPayment({
      transactionId: started.payment.transactionId,
      amount: started.payment.amount,
      currency: started.payment.currency,
      callbackUrl: "https://app.example.test/lgu/callback",
      redirectUrl: "https://app.example.test/lgu/return",
      items: [],
      description: { applicationId: application.applicationId },
    });

    const recovered = await context.service.syncPaymentStatus({
      transactionUuid: checkout.transactionUuid,
    });
    const recoveredCheckout = await context.service.createPayment({
      actor: context.actor,
      applicationId: application.applicationId,
      callbackUrl: "https://app.example.test/lgu/callback",
      redirectUrl: "https://app.example.test/lgu/return",
    });

    expect(recovered.status).toMatchObject({
      state: "PAYMENT_PENDING",
      payment: { status: "PENDING", transactionId: started.payment.transactionId },
    });
    expect(recoveredCheckout).toEqual(checkout);
  });

  test("accepts a callback when checkout activation wins the lookup race", async () => {
    const context = setup();
    const application = await prepareApplication(context);
    const started = await context.repository.beginPayment({
      applicationId: application.applicationId,
      egovUserId: context.actor.egovUserId,
      transactionId: "LGU-PAY-activation-race",
      amount: 2_500,
      currency: "PHP",
      providerCallbackUrl: "https://app.example.test/lgu/callback",
      providerRedirectUrl: "https://app.example.test/lgu/return",
      now: NOW,
    });
    if (!started) throw new Error("Expected payment creation to start");
    const checkout = await context.paymentProvider.createPayment({
      transactionId: started.payment.transactionId,
      amount: started.payment.amount,
      currency: started.payment.currency,
      callbackUrl: started.payment.providerCallbackUrl,
      redirectUrl: started.payment.providerRedirectUrl,
      items: [],
      description: { applicationId: application.applicationId },
    });
    const providerGetTransaction = context.paymentProvider.getTransaction.bind(
      context.paymentProvider,
    );
    context.paymentProvider.getTransaction = async (transactionUuid) => {
      await context.repository.activatePayment({
        paymentId: started.payment.id,
        transactionUuid: checkout.transactionUuid,
        checkoutUrl: checkout.checkoutUrl,
        providerStatus: "pending",
        expiresAt: null,
        now: NOW,
      });
      return providerGetTransaction(transactionUuid);
    };

    const synced = await context.service.syncPaymentStatus({
      transactionUuid: checkout.transactionUuid,
    });

    expect(synced.status).toMatchObject({
      state: "PAYMENT_PENDING",
      payment: { status: "PENDING", transactionId: started.payment.transactionId },
    });
  });

  test("issues and retrieves the permit and clearance pair after verified payment", async () => {
    const context = setup();
    const application = await prepareApplication(context);
    const checkout = await context.service.createPayment({
      actor: context.actor,
      applicationId: application.applicationId,
      callbackUrl: "https://app.example.test/lgu/callback",
      redirectUrl: "https://app.example.test/lgu/return",
    });
    context.paymentProvider.updateTransaction(checkout.transactionUuid, {
      status: "PAID",
      providerStatus: "paid",
      paidAt: NOW,
    });

    const completed = await context.service.syncPaymentStatus({
      transactionUuid: checkout.transactionUuid,
    });
    const retried = await context.service.syncPaymentStatus({
      transactionUuid: checkout.transactionUuid,
    });
    const fetched = await context.service.getIssuedDocuments({
      actor: context.actor,
      applicationId: application.applicationId,
    });
    const listed = await context.service.listIssuedDocuments({ actor: context.actor });

    expect(completed.status).toMatchObject({ state: "COMPLETED", documentsIssued: true });
    expect(JSON.stringify(completed)).not.toContain("Mara Reyes");
    expect(JSON.stringify(completed)).not.toContain("123456789000");
    expect(fetched).toEqual({
      applicationId: application.applicationId,
      businessPermit: {
        permitNumber: "LGU-BP-2026-BBBBBBBB",
        issuingLgu: "Makati City",
        permitType: "NEW_BUSINESS",
        bnrsCertificateNumber: "BN-2026-00001234",
        businessName: "Molar Bear Dental Clinic",
        ownerName: "Mara Reyes",
        tin: "123456789000",
        businessActivity: "Dental Clinic",
        territorialScope: "CITY_MUNICIPALITY",
        issuedAt: NOW.toISOString(),
        validUntil: "2026-12-31T23:59:59.999Z",
        status: "ACTIVE",
        totalPaid: 2_500,
      },
      barangayClearance: {
        clearanceNumber: "LGU-BC-2026-CCCCCCCC",
        issuingLgu: "Makati City",
        clearanceType: "BARANGAY_BUSINESS_CLEARANCE",
        bnrsCertificateNumber: "BN-2026-00001234",
        businessName: "Molar Bear Dental Clinic",
        ownerName: "Mara Reyes",
        tin: "123456789000",
        businessActivity: "Dental Clinic",
        issuedAt: NOW.toISOString(),
        validUntil: "2026-12-31T23:59:59.999Z",
        status: "APPROVED",
        includedInBusinessPermitFee: true,
      },
    });
    expect(retried).toEqual(completed);
    expect(listed).toEqual([fetched]);
  });

  test("preserves one document pair across concurrent paid callbacks", async () => {
    const context = setup();
    const application = await prepareApplication(context);
    const checkout = await context.service.createPayment({
      actor: context.actor,
      applicationId: application.applicationId,
      callbackUrl: "https://app.example.test/lgu/callback",
      redirectUrl: "https://app.example.test/lgu/return",
    });
    context.paymentProvider.updateTransaction(checkout.transactionUuid, {
      status: "PAID",
      providerStatus: "paid",
      paidAt: NOW,
    });

    const [first, second] = await Promise.all([
      context.service.syncPaymentStatus({ transactionUuid: checkout.transactionUuid }),
      context.service.syncPaymentStatus({ transactionUuid: checkout.transactionUuid }),
    ]);
    const documents = await context.service.getIssuedDocuments({
      actor: context.actor,
      applicationId: application.applicationId,
    });

    expect(first).toEqual(second);
    expect(documents.businessPermit.permitNumber).toBe(
      context.repository.applications.get(application.applicationId)?.permitNumber,
    );
    expect(documents.barangayClearance.clearanceNumber).toBe(
      context.repository.applications.get(application.applicationId)?.barangayClearanceNumber,
    );
  });

  test("rejects an authoritative transaction with changed immutable payment data", async () => {
    const context = setup();
    const application = await prepareApplication(context);
    const checkout = await context.service.createPayment({
      actor: context.actor,
      applicationId: application.applicationId,
      callbackUrl: "https://app.example.test/lgu/callback",
      redirectUrl: "https://app.example.test/lgu/return",
    });
    context.paymentProvider.updateTransaction(checkout.transactionUuid, {
      amount: 1,
      status: "PAID",
      providerStatus: "paid",
      paidAt: NOW,
    });

    await expectLguError(
      () => context.service.syncPaymentStatus({ transactionUuid: checkout.transactionUuid }),
      "PAYMENT_VERIFICATION_FAILED",
    );
    expect(context.repository.applications.get(application.applicationId)).toMatchObject({
      state: "PAYMENT_PENDING",
      permitNumber: null,
      barangayClearanceNumber: null,
    });
  });

  test("returns failed payments to payment-ready", async () => {
    const context = setup();
    const application = await prepareApplication(context);
    const checkout = await context.service.createPayment({
      actor: context.actor,
      applicationId: application.applicationId,
      callbackUrl: "https://app.example.test/lgu/callback",
      redirectUrl: "https://app.example.test/lgu/return",
    });
    context.paymentProvider.updateTransaction(checkout.transactionUuid, {
      status: "FAILED",
      providerStatus: "failed",
    });

    const synced = await context.service.syncPaymentStatus({
      transactionUuid: checkout.transactionUuid,
    });

    expect(synced.status).toMatchObject({
      state: "PAYMENT_READY",
      payment: { status: "FAILED" },
      documentsIssued: false,
    });
  });

  test("does not let a stale failed callback release a newer checkout", async () => {
    const context = setup();
    const application = await prepareApplication(context);
    const paymentInput = {
      actor: context.actor,
      applicationId: application.applicationId,
      callbackUrl: "https://app.example.test/lgu/callback",
      redirectUrl: "https://app.example.test/lgu/return",
    };
    const first = await context.service.createPayment(paymentInput);
    context.paymentProvider.updateTransaction(first.transactionUuid, {
      status: "FAILED",
      providerStatus: "failed",
    });
    await context.service.syncPaymentStatus({ transactionUuid: first.transactionUuid });
    const second = await context.service.createPayment(paymentInput);

    const replayed = await context.service.syncPaymentStatus({
      transactionUuid: first.transactionUuid,
    });

    expect(second.transactionUuid).not.toBe(first.transactionUuid);
    expect(replayed.status).toMatchObject({
      state: "PAYMENT_PENDING",
      payment: { status: "PENDING", transactionId: second.transactionId },
    });
  });

  test("voids a pending provider transaction before abandoning", async () => {
    const context = setup();
    const application = await prepareApplication(context);
    const checkout = await context.service.createPayment({
      actor: context.actor,
      applicationId: application.applicationId,
      callbackUrl: "https://app.example.test/lgu/callback",
      redirectUrl: "https://app.example.test/lgu/return",
    });

    const abandoned = await context.service.abandonApplication({
      actor: context.actor,
      applicationId: application.applicationId,
    });

    expect(context.paymentProvider.voided).toEqual([checkout.transactionUuid]);
    expect(abandoned.state).toBe("ABANDONED");
  });

  test("completes rather than abandoning when payment already succeeded", async () => {
    const context = setup();
    const application = await prepareApplication(context);
    const checkout = await context.service.createPayment({
      actor: context.actor,
      applicationId: application.applicationId,
      callbackUrl: "https://app.example.test/lgu/callback",
      redirectUrl: "https://app.example.test/lgu/return",
    });
    context.paymentProvider.updateTransaction(checkout.transactionUuid, {
      status: "PAID",
      providerStatus: "paid",
      paidAt: NOW,
    });

    const result = await context.service.abandonApplication({
      actor: context.actor,
      applicationId: application.applicationId,
    });

    expect(result.state).toBe("COMPLETED");
    expect(result.issuedDocuments).not.toBeNull();
    expect(context.paymentProvider.voided).toEqual([]);
  });

  test("does not retrieve documents for an incomplete application", async () => {
    const context = setup();
    const application = await prepareApplication(context);

    await expectLguError(
      () =>
        context.service.getIssuedDocuments({
          actor: context.actor,
          applicationId: application.applicationId,
        }),
      "ISSUED_DOCUMENTS_NOT_FOUND",
    );
  });
});
