import { describe, expect, test } from "bun:test";

import { BnrsError, createBnrsService } from "../src/bnrs/index.js";
import { FakePaymentProvider } from "./support/fake-payment-provider.js";
import { MemoryBnrsRepository } from "./support/memory-repository.js";

const NOW = new Date("2026-07-29T08:30:00.000Z");

function setup() {
  const repository = new MemoryBnrsRepository();
  const paymentProvider = new FakePaymentProvider();
  const generatedIds = [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  ];
  const service = createBnrsService({
    repository,
    paymentProvider,
    now: () => NOW,
    generateId: () => generatedIds.shift() ?? crypto.randomUUID(),
  });
  return {
    actor: { egovUserId: "egov-user-1" },
    paymentProvider,
    repository,
    service,
  };
}

async function prepareApplication(context: ReturnType<typeof setup>) {
  const application = await context.service.startOrResumeApplication({ actor: context.actor });
  await context.service.acceptTermsAndConditions({
    actor: context.actor,
    applicationId: application.applicationId,
  });
  await context.service.setOwnerInformation({
    actor: context.actor,
    applicationId: application.applicationId,
    owner: { firstName: "Genrev", middleName: "Eledia", lastName: "Zapa" },
  });
  await context.service.setBusinessName({
    actor: context.actor,
    applicationId: application.applicationId,
    dominantName: "Molar Bear",
    descriptorId: "DENTAL_CLINIC",
  });
  await context.service.setBusinessScope({
    actor: context.actor,
    applicationId: application.applicationId,
    scopeId: "NATIONAL",
  });
  return application.applicationId;
}

async function expectBnrsError(action: () => Promise<unknown>, code: BnrsError["code"]) {
  try {
    await action();
    throw new Error("Expected a BnrsError");
  } catch (error) {
    expect(error).toBeInstanceOf(BnrsError);
    expect((error as BnrsError).code).toBe(code);
  }
}

describe("BNRS hosted payments", () => {
  test("creates and reuses a hosted checkout with registration and DST items", async () => {
    const context = setup();
    const applicationId = await prepareApplication(context);
    const input = {
      actor: context.actor,
      applicationId,
      callbackUrl: "https://app.example.test/payments/callback",
      redirectUrl: "https://app.example.test/payments/return",
    };

    const created = await context.service.createPayment(input);
    const retried = await context.service.createPayment(input);
    const status = await context.service.getStatus({ actor: context.actor, applicationId });

    expect(retried).toEqual(created);
    expect(context.paymentProvider.createInputs).toHaveLength(1);
    expect(context.paymentProvider.createInputs[0]).toMatchObject({
      amount: 2_030,
      currency: "PHP",
      items: [
        { amount: 2_000, name: "DTI Business Name Registration — National" },
        { amount: 30, name: "Documentary Stamp Tax" },
      ],
    });
    expect(status).toMatchObject({
      state: "PAYMENT_PENDING",
      payment: { status: "PENDING", amount: 2_030, currency: "PHP" },
    });
  });

  test("recovers a checkout when the first provider response is lost", async () => {
    const context = setup();
    const applicationId = await prepareApplication(context);
    const input = {
      actor: context.actor,
      applicationId,
      callbackUrl: "https://app.example.test/payments/callback",
      redirectUrl: "https://app.example.test/payments/return",
    };
    context.paymentProvider.failAfterNextCreation = true;

    await expectBnrsError(() => context.service.createPayment(input), "PAYMENT_PROVIDER_ERROR");
    const recovered = await context.service.createPayment(input);

    expect(context.paymentProvider.createInputs).toHaveLength(2);
    expect(context.paymentProvider.createInputs[1]?.transactionId).toBe(
      context.paymentProvider.createInputs[0]?.transactionId,
    );
    expect(recovered.transactionId).toBe(context.paymentProvider.createInputs[0]?.transactionId);
    expect(context.repository.applications.get(applicationId)?.state).toBe("PAYMENT_PENDING");
  });

  test("attaches an authoritative callback to a creating attempt by transaction ID", async () => {
    const context = setup();
    const applicationId = await prepareApplication(context);
    const started = await context.repository.beginPayment({
      applicationId,
      egovUserId: context.actor.egovUserId,
      transactionId: "BNRS-PAY-callback-recovery",
      amount: 2_030,
      currency: "PHP",
      now: NOW,
    });
    if (!started) throw new Error("Expected payment creation to start");
    const checkout = await context.paymentProvider.createPayment({
      transactionId: started.payment.transactionId,
      amount: started.payment.amount,
      currency: started.payment.currency,
      callbackUrl: "https://app.example.test/payments/callback",
      redirectUrl: "https://app.example.test/payments/return",
      items: [],
      description: { applicationId },
    });

    const recovered = await context.service.syncPaymentStatus({
      transactionUuid: checkout.transactionUuid,
    });
    const recoveredCheckout = await context.service.createPayment({
      actor: context.actor,
      applicationId,
      callbackUrl: "https://app.example.test/payments/callback",
      redirectUrl: "https://app.example.test/payments/return",
    });

    expect(recovered.status).toMatchObject({
      state: "PAYMENT_PENDING",
      payment: {
        status: "PENDING",
        transactionId: started.payment.transactionId,
      },
    });
    expect(recoveredCheckout).toEqual(checkout);
  });

  test("completes only after an authoritative matching paid snapshot", async () => {
    const context = setup();
    const applicationId = await prepareApplication(context);
    const checkout = await context.service.createPayment({
      actor: context.actor,
      applicationId,
      callbackUrl: "https://app.example.test/payments/callback",
      redirectUrl: "https://app.example.test/payments/return",
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

    expect(completed.status.state).toBe("COMPLETED");
    expect(completed.registration).toEqual({
      referenceCode: "BNRS-20260729-BBBBBBBB",
      businessName: "Molar Bear Dental Clinic",
      descriptor: "DENTAL CLINIC",
      scope: "NATIONAL",
      ownerDisplayName: "Genrev Eledia Zapa",
      issuedAt: NOW.toISOString(),
      totalPaid: 2_030,
    });
    expect(retried.registration?.referenceCode).toBe(completed.registration?.referenceCode);
  });

  test("does not complete a payment whose authoritative amount is different", async () => {
    const context = setup();
    const applicationId = await prepareApplication(context);
    const checkout = await context.service.createPayment({
      actor: context.actor,
      applicationId,
      callbackUrl: "https://app.example.test/payments/callback",
      redirectUrl: "https://app.example.test/payments/return",
    });
    context.paymentProvider.updateTransaction(checkout.transactionUuid, {
      amount: 1,
      status: "PAID",
      providerStatus: "paid",
      paidAt: NOW,
    });

    await expectBnrsError(
      () => context.service.syncPaymentStatus({ transactionUuid: checkout.transactionUuid }),
      "PAYMENT_VERIFICATION_FAILED",
    );
    expect(context.repository.applications.get(applicationId)?.state).toBe("PAYMENT_PENDING");
  });

  test("returns failed payments to payment-ready so details can be edited", async () => {
    const context = setup();
    const applicationId = await prepareApplication(context);
    const checkout = await context.service.createPayment({
      actor: context.actor,
      applicationId,
      callbackUrl: "https://app.example.test/payments/callback",
      redirectUrl: "https://app.example.test/payments/return",
    });
    context.paymentProvider.updateTransaction(checkout.transactionUuid, {
      status: "FAILED",
      providerStatus: "failed",
    });

    const synced = await context.service.syncPaymentStatus({
      transactionUuid: checkout.transactionUuid,
    });

    expect(synced.status.state).toBe("PAYMENT_READY");
    expect(synced.status.payment?.status).toBe("FAILED");
  });

  test("does not let a stale callback release a newer active checkout", async () => {
    const context = setup();
    const applicationId = await prepareApplication(context);
    const first = await context.service.createPayment({
      actor: context.actor,
      applicationId,
      callbackUrl: "https://app.example.test/payments/callback",
      redirectUrl: "https://app.example.test/payments/return",
    });
    context.paymentProvider.updateTransaction(first.transactionUuid, {
      status: "FAILED",
      providerStatus: "failed",
    });
    await context.service.syncPaymentStatus({ transactionUuid: first.transactionUuid });

    const second = await context.service.createPayment({
      actor: context.actor,
      applicationId,
      callbackUrl: "https://app.example.test/payments/callback",
      redirectUrl: "https://app.example.test/payments/return",
    });
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
    const applicationId = await prepareApplication(context);
    const checkout = await context.service.createPayment({
      actor: context.actor,
      applicationId,
      callbackUrl: "https://app.example.test/payments/callback",
      redirectUrl: "https://app.example.test/payments/return",
    });

    const abandoned = await context.service.abandonApplication({
      actor: context.actor,
      applicationId,
    });

    expect(context.paymentProvider.voided).toEqual([checkout.transactionUuid]);
    expect(abandoned.state).toBe("ABANDONED");
  });

  test("completes rather than abandoning when the provider already reports payment", async () => {
    const context = setup();
    const applicationId = await prepareApplication(context);
    const checkout = await context.service.createPayment({
      actor: context.actor,
      applicationId,
      callbackUrl: "https://app.example.test/payments/callback",
      redirectUrl: "https://app.example.test/payments/return",
    });
    context.paymentProvider.updateTransaction(checkout.transactionUuid, {
      status: "PAID",
      providerStatus: "paid",
      paidAt: NOW,
    });

    const result = await context.service.abandonApplication({
      actor: context.actor,
      applicationId,
    });

    expect(result.state).toBe("COMPLETED");
    expect(context.paymentProvider.voided).toEqual([]);
  });
});
