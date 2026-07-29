import type {
  BnrsApplicationRecord,
  BnrsPaymentRecord,
  BnrsRepository,
} from "../../src/bnrs/repository.js";
import { BnrsRepositoryConflict } from "../../src/bnrs/repository.js";
import type { BnrsOwnerInformationInput } from "../../src/bnrs/types.js";

const terminalStates = new Set(["COMPLETED", "ABANDONED"]);

export class MemoryBnrsRepository implements BnrsRepository {
  readonly applications = new Map<string, BnrsApplicationRecord>();
  readonly owners = new Map<string, BnrsOwnerInformationInput>();
  readonly payments = new Map<string, BnrsPaymentRecord>();

  async startOrResumeApplication(egovUserId: string, now: Date) {
    const active = [...this.applications.values()].find(
      (application) =>
        application.egovUserId === egovUserId && !terminalStates.has(application.state),
    );
    if (active) return structuredClone(active);

    const application: BnrsApplicationRecord = {
      id: crypto.randomUUID(),
      egovUserId,
      state: "TERMS_PENDING",
      termsAcceptedAt: null,
      dominantName: null,
      descriptorId: null,
      descriptorLabel: null,
      proposedBusinessName: null,
      normalizedBusinessName: null,
      scope: null,
      registrationFee: null,
      documentaryStampTax: null,
      totalFee: null,
      latestPaymentId: null,
      referenceCode: null,
      issuedAt: null,
      abandonedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.applications.set(application.id, application);
    return structuredClone(application);
  }

  async getApplication(applicationId: string) {
    const application = this.applications.get(applicationId);
    return application ? structuredClone(application) : null;
  }

  async listCompletedApplications(egovUserId: string) {
    return [...this.applications.values()]
      .filter(
        (application) => application.egovUserId === egovUserId && application.state === "COMPLETED",
      )
      .sort(
        (left, right) =>
          (right.issuedAt?.getTime() ?? 0) - (left.issuedAt?.getTime() ?? 0) ||
          right.createdAt.getTime() - left.createdAt.getTime(),
      )
      .map((application) => structuredClone(application));
  }

  async hasOwnerInformation(applicationId: string) {
    return this.owners.has(applicationId);
  }

  async getOwnerInformation(applicationId: string) {
    const owner = this.owners.get(applicationId);
    return owner ? structuredClone(owner) : null;
  }

  async updateApplication(
    input: Parameters<BnrsRepository["updateApplication"]>[0],
  ): Promise<BnrsApplicationRecord | null> {
    const application = this.applications.get(input.applicationId);
    if (
      !application ||
      application.egovUserId !== input.egovUserId ||
      !input.expectedStates.includes(application.state)
    )
      return null;

    Object.assign(application, input.patch, { updatedAt: input.now });
    return structuredClone(application);
  }

  async saveOwnerInformationAndAdvance(
    input: Parameters<BnrsRepository["saveOwnerInformationAndAdvance"]>[0],
  ): Promise<BnrsApplicationRecord | null> {
    const application = this.applications.get(input.applicationId);
    if (
      !application ||
      application.egovUserId !== input.egovUserId ||
      application.state !== input.expectedState
    )
      return null;

    this.owners.set(input.applicationId, structuredClone(input.owner));
    application.state = "BUSINESS_NAME_PENDING";
    application.updatedAt = input.now;
    return structuredClone(application);
  }

  async isBusinessNameReserved(input: Parameters<BnrsRepository["isBusinessNameReserved"]>[0]) {
    return [...this.applications.values()].some(
      (application) =>
        application.id !== input.excludeApplicationId &&
        application.normalizedBusinessName === input.normalizedBusinessName &&
        (application.state === "PAYMENT_PENDING" || application.state === "COMPLETED"),
    );
  }

  async getLatestPayment(applicationId: string) {
    const latestPaymentId = this.applications.get(applicationId)?.latestPaymentId;
    if (latestPaymentId) {
      const latest = this.payments.get(latestPaymentId);
      if (latest) return structuredClone(latest);
    }
    const payment = [...this.payments.values()]
      .filter((candidate) => candidate.applicationId === applicationId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
    return payment ? structuredClone(payment) : null;
  }

  async getCurrentPayment(applicationId: string) {
    const latestPaymentId = this.applications.get(applicationId)?.latestPaymentId;
    const payment = latestPaymentId ? this.payments.get(latestPaymentId) : undefined;
    if (payment && payment.status !== "CREATING" && payment.status !== "PENDING") return null;
    return payment ? structuredClone(payment) : null;
  }

  async getPaymentByTransactionUuid(transactionUuid: string) {
    const payment = [...this.payments.values()].find(
      (candidate) => candidate.transactionUuid === transactionUuid,
    );
    return payment ? structuredClone(payment) : null;
  }

  async getPaymentByTransactionId(transactionId: string) {
    const payment = [...this.payments.values()].find(
      (candidate) => candidate.transactionId === transactionId,
    );
    return payment ? structuredClone(payment) : null;
  }

  async beginPayment(input: Parameters<BnrsRepository["beginPayment"]>[0]) {
    const application = this.applications.get(input.applicationId);
    if (
      !application ||
      application.egovUserId !== input.egovUserId ||
      application.state !== "PAYMENT_READY"
    )
      return null;
    if (await this.getCurrentPayment(input.applicationId))
      throw new BnrsRepositoryConflict("PAYMENT_IN_PROGRESS");
    if (
      application.normalizedBusinessName &&
      (await this.isBusinessNameReserved({
        normalizedBusinessName: application.normalizedBusinessName,
        excludeApplicationId: application.id,
      }))
    )
      throw new BnrsRepositoryConflict("BUSINESS_NAME_RESERVED");

    const payment: BnrsPaymentRecord = {
      id: crypto.randomUUID(),
      applicationId: application.id,
      provider: "EGOVPAY",
      status: "CREATING",
      transactionId: input.transactionId,
      transactionUuid: null,
      checkoutUrl: null,
      amount: input.amount,
      currency: input.currency,
      providerStatus: null,
      paidAt: null,
      expiresAt: null,
      createdAt: input.now,
      updatedAt: input.now,
    };
    application.state = "PAYMENT_PENDING";
    application.latestPaymentId = payment.id;
    application.updatedAt = input.now;
    this.payments.set(payment.id, payment);
    return { application: structuredClone(application), payment: structuredClone(payment) };
  }

  async activatePayment(input: Parameters<BnrsRepository["activatePayment"]>[0]) {
    const payment = this.payments.get(input.paymentId);
    if (!payment || (payment.status !== "CREATING" && payment.status !== "PENDING")) return null;
    Object.assign(payment, {
      status: "PENDING" as const,
      transactionUuid: input.transactionUuid,
      checkoutUrl: input.checkoutUrl,
      providerStatus: input.providerStatus,
      expiresAt: input.expiresAt,
      updatedAt: input.now,
    });
    return structuredClone(payment);
  }

  async failPaymentCreation(input: Parameters<BnrsRepository["failPaymentCreation"]>[0]) {
    const payment = this.payments.get(input.paymentId);
    const application = this.applications.get(input.applicationId);
    if (!payment || !application || payment.status !== "CREATING") return null;
    if (application.latestPaymentId !== payment.id) return null;
    payment.status = "FAILED";
    payment.providerStatus = input.providerStatus;
    payment.updatedAt = input.now;
    application.state = "PAYMENT_READY";
    application.updatedAt = input.now;
    return { application: structuredClone(application), payment: structuredClone(payment) };
  }

  async recordPendingPayment(input: Parameters<BnrsRepository["recordPendingPayment"]>[0]) {
    const payment = this.payments.get(input.paymentId);
    if (!payment || (payment.status !== "CREATING" && payment.status !== "PENDING")) return null;
    payment.status = "PENDING";
    payment.providerStatus = input.providerStatus;
    payment.expiresAt = input.expiresAt;
    payment.updatedAt = input.now;
    return structuredClone(payment);
  }

  async releasePayment(input: Parameters<BnrsRepository["releasePayment"]>[0]) {
    const payment = this.payments.get(input.paymentId);
    const application = this.applications.get(input.applicationId);
    if (!payment || !application) return null;
    if (application.latestPaymentId !== payment.id) return null;
    payment.status = input.status;
    payment.providerStatus = input.providerStatus;
    payment.expiresAt = input.expiresAt;
    payment.updatedAt = input.now;
    application.state = "PAYMENT_READY";
    application.updatedAt = input.now;
    return { application: structuredClone(application), payment: structuredClone(payment) };
  }

  async completePayment(input: Parameters<BnrsRepository["completePayment"]>[0]) {
    const payment = this.payments.get(input.paymentId);
    const application = this.applications.get(input.applicationId);
    if (!payment || !application) return null;
    if (application.latestPaymentId !== payment.id) return null;
    if (application.state !== "PAYMENT_PENDING" && application.state !== "COMPLETED") return null;
    payment.status = "PAID";
    payment.providerStatus = input.providerStatus;
    payment.paidAt = input.paidAt;
    payment.updatedAt = input.now;
    application.state = "COMPLETED";
    application.referenceCode ??= input.referenceCode;
    application.issuedAt ??= input.issuedAt;
    application.updatedAt = input.now;
    return { application: structuredClone(application), payment: structuredClone(payment) };
  }
}
