import type {
  LguApplicationRecord,
  LguApplicantInformationRecord,
  LguPaymentRecord,
  LguRepository,
} from "../../src/lgu/repository.js";
import { LguRepositoryConflict } from "../../src/lgu/repository.js";

export class MemoryLguRepository implements LguRepository {
  readonly applications = new Map<string, LguApplicationRecord>();
  readonly applicants = new Map<string, LguApplicantInformationRecord>();
  readonly payments = new Map<string, LguPaymentRecord>();

  async startOrResumeApplication(input: Parameters<LguRepository["startOrResumeApplication"]>[0]) {
    const existing = [...this.applications.values()].find(
      (application) =>
        application.egovUserId === input.egovUserId &&
        application.certificateNumber === input.certificate.certificateNumber &&
        application.normalizedCity === input.normalizedCity &&
        application.state !== "ABANDONED",
    );
    if (existing) {
      const applicant = this.applicants.get(existing.id);
      if (!applicant) throw new Error("LGU applicant fixture is unavailable.");
      return { application: structuredClone(existing), applicant: structuredClone(applicant) };
    }

    const application: LguApplicationRecord = {
      id: crypto.randomUUID(),
      egovUserId: input.egovUserId,
      state: "PAYMENT_READY",
      city: input.city,
      normalizedCity: input.normalizedCity,
      businessAddressLine1: input.certificate.businessAddress.addressLine1,
      businessAddressLine2: input.certificate.businessAddress.addressLine2 ?? null,
      businessBarangay: input.certificate.businessAddress.barangay,
      businessProvince: input.certificate.businessAddress.province,
      businessRegion: input.certificate.businessAddress.region,
      businessPostalCode: input.certificate.businessAddress.postalCode,
      certificateNumber: input.certificate.certificateNumber,
      certificateIssuingAgency: input.certificate.issuingAgency,
      certificateStatus: input.certificate.status,
      certificateBusinessName: input.certificate.businessName,
      certificateOwnerName: input.certificate.ownerName,
      certificateDescriptor: input.certificate.descriptor,
      certificateTerritorialScope: input.certificate.territorialScope,
      certificateIssuedAt: input.certificate.issuedAt,
      certificateValidUntil: input.certificate.validUntil,
      latestPaymentId: null,
      permitNumber: null,
      barangayClearanceNumber: null,
      documentsIssuedAt: null,
      documentsValidUntil: null,
      abandonedAt: null,
      createdAt: input.now,
      updatedAt: input.now,
    };
    this.applications.set(application.id, application);
    this.applicants.set(application.id, structuredClone(input.applicant));
    return {
      application: structuredClone(application),
      applicant: structuredClone(input.applicant),
    };
  }

  async getApplication(applicationId: string) {
    const application = this.applications.get(applicationId);
    return application ? structuredClone(application) : null;
  }

  async getApplicantInformation(applicationId: string) {
    const applicant = this.applicants.get(applicationId);
    return applicant ? structuredClone(applicant) : null;
  }

  async listCompletedApplications(egovUserId: string) {
    return [...this.applications.values()]
      .filter(
        (application) => application.egovUserId === egovUserId && application.state === "COMPLETED",
      )
      .sort(
        (left, right) =>
          (right.documentsIssuedAt?.getTime() ?? 0) - (left.documentsIssuedAt?.getTime() ?? 0) ||
          right.createdAt.getTime() - left.createdAt.getTime(),
      )
      .map((application) => structuredClone(application));
  }

  async updateApplication(input: Parameters<LguRepository["updateApplication"]>[0]) {
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
    const payment = await this.getLatestPayment(applicationId);
    return payment && (payment.status === "CREATING" || payment.status === "PENDING")
      ? payment
      : null;
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

  async beginPayment(input: Parameters<LguRepository["beginPayment"]>[0]) {
    const application = this.applications.get(input.applicationId);
    if (
      !application ||
      application.egovUserId !== input.egovUserId ||
      application.state !== "PAYMENT_READY"
    )
      return null;
    if (await this.getCurrentPayment(input.applicationId))
      throw new LguRepositoryConflict("PAYMENT_IN_PROGRESS");
    const payment: LguPaymentRecord = {
      id: crypto.randomUUID(),
      applicationId: application.id,
      provider: "EGOVPAY",
      status: "CREATING",
      transactionId: input.transactionId,
      transactionUuid: null,
      checkoutUrl: null,
      providerCallbackUrl: input.providerCallbackUrl,
      providerRedirectUrl: input.providerRedirectUrl,
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

  async activatePayment(input: Parameters<LguRepository["activatePayment"]>[0]) {
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

  async recordPendingPayment(input: Parameters<LguRepository["recordPendingPayment"]>[0]) {
    const payment = this.payments.get(input.paymentId);
    if (!payment || (payment.status !== "CREATING" && payment.status !== "PENDING")) return null;
    payment.status = "PENDING";
    payment.providerStatus = input.providerStatus;
    payment.expiresAt = input.expiresAt;
    payment.updatedAt = input.now;
    return structuredClone(payment);
  }

  async releasePayment(input: Parameters<LguRepository["releasePayment"]>[0]) {
    const payment = this.payments.get(input.paymentId);
    const application = this.applications.get(input.applicationId);
    if (!payment || !application || application.latestPaymentId !== payment.id) return null;
    payment.status = input.status;
    payment.providerStatus = input.providerStatus;
    payment.expiresAt = input.expiresAt;
    payment.updatedAt = input.now;
    application.state = "PAYMENT_READY";
    application.updatedAt = input.now;
    return { application: structuredClone(application), payment: structuredClone(payment) };
  }

  async completePayment(input: Parameters<LguRepository["completePayment"]>[0]) {
    const payment = this.payments.get(input.paymentId);
    const application = this.applications.get(input.applicationId);
    if (!payment || !application || application.latestPaymentId !== payment.id) return null;
    if (application.state !== "PAYMENT_PENDING" && application.state !== "COMPLETED") return null;
    payment.status = "PAID";
    payment.providerStatus = input.providerStatus;
    payment.paidAt = input.paidAt;
    payment.updatedAt = input.now;
    application.state = "COMPLETED";
    application.permitNumber ??= input.permitNumber;
    application.barangayClearanceNumber ??= input.barangayClearanceNumber;
    application.documentsIssuedAt ??= input.issuedAt;
    application.documentsValidUntil ??= input.validUntil;
    application.updatedAt = input.now;
    return { application: structuredClone(application), payment: structuredClone(payment) };
  }
}
