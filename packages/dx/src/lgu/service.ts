import { getLguPaymentQuote } from "./constants.js";
import { LguError } from "./errors.js";
import type {
  LguApplicationRecord,
  LguApplicantInformationRecord,
  LguPaymentRecord,
  LguRepository,
} from "./repository.js";
import { LguRepositoryConflict } from "./repository.js";
import type {
  LguActor,
  LguApplicationStatus,
  LguApplicantInformationInput,
  LguBusinessAddressInput,
  LguBusinessRegistrationCredentialInput,
  LguIssuedDocuments,
  LguPaymentCheckout,
  LguPaymentProvider,
  LguPaymentProviderSnapshot,
  LguPaymentSummary,
  LguPaymentSyncResult,
  LguTerritorialScope,
} from "./types.js";

export interface LguServiceOptions {
  repository: LguRepository;
  paymentProvider?: LguPaymentProvider;
  now?: () => Date;
  generateId?: () => string;
}

const territorialScopes = new Set<LguTerritorialScope>([
  "CITY_MUNICIPALITY",
  "REGIONAL",
  "NATIONAL",
]);

function normalizedRequiredString(
  value: unknown,
  code: "INVALID_APPLICANT" | "INVALID_CITY" | "INVALID_CERTIFICATE",
  field: string,
  maximum: number,
): string {
  if (typeof value !== "string") throw new LguError(code, `${field} is required.`);
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > maximum)
    throw new LguError(code, `${field} must be between 1 and ${maximum} characters.`);
  return normalized;
}

function comparisonKey(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleUpperCase("en-PH");
}

export function normalizeLguTin(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "string" || typeof value === "number") {
    const digits = String(value).replaceAll(/\D/g, "");
    return digits.length >= 9 && digits.length <= 14 ? digits : undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["tin", "tin_number", "tinNumber", "id_number"]) {
    const tin = normalizeLguTin(record[key]);
    if (tin) return tin;
  }
  return undefined;
}

function validateActor(actor: LguActor): string {
  const egovUserId = actor.egovUserId.trim();
  if (!egovUserId) throw new LguError("INVALID_ACTOR", "An authenticated eGov user is required.");
  return egovUserId;
}

function normalizeApplicant(input: LguApplicantInformationInput): LguApplicantInformationRecord {
  const ownerName = normalizedRequiredString(
    input.ownerName,
    "INVALID_APPLICANT",
    "Owner name",
    240,
  );
  const tin = normalizeLguTin(input.tin);
  if (input.tin !== undefined && !tin)
    throw new LguError("INVALID_APPLICANT", "TIN must contain between 9 and 14 digits.");
  return {
    ownerName,
    normalizedOwnerName: comparisonKey(ownerName),
    ...(tin === undefined ? {} : { tin }),
  };
}

function normalizeBusinessAddress(input: unknown): LguBusinessAddressInput {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new LguError(
      "INVALID_CERTIFICATE",
      "A structured business address is required in the certificate.",
    );
  const address = input as Record<string, unknown>;
  const addressLine1 = normalizedRequiredString(
    address.addressLine1,
    "INVALID_CERTIFICATE",
    "Business address line 1",
    300,
  );
  const addressLine2 = address.addressLine2
    ? normalizedRequiredString(
        address.addressLine2,
        "INVALID_CERTIFICATE",
        "Business address line 2",
        200,
      )
    : undefined;
  const barangay = normalizedRequiredString(
    address.barangay,
    "INVALID_CERTIFICATE",
    "Business barangay",
    120,
  );
  const cityMunicipality = normalizedRequiredString(
    address.cityMunicipality,
    "INVALID_CERTIFICATE",
    "Business city/municipality",
    120,
  );
  const province = normalizedRequiredString(
    address.province,
    "INVALID_CERTIFICATE",
    "Business province",
    120,
  );
  const region = normalizedRequiredString(
    address.region,
    "INVALID_CERTIFICATE",
    "Business region",
    120,
  );
  const postalCode = normalizedRequiredString(
    address.postalCode,
    "INVALID_CERTIFICATE",
    "Business postal code",
    4,
  );
  if (!/^\d{4}$/.test(postalCode))
    throw new LguError(
      "INVALID_CERTIFICATE",
      "Business postal code must contain exactly four digits.",
    );
  return {
    addressLine1,
    ...(addressLine2 === undefined ? {} : { addressLine2 }),
    barangay,
    cityMunicipality,
    province,
    region,
    postalCode,
  };
}

function parsedCertificateDate(value: unknown, field: string): Date {
  if (typeof value !== "string" || !value.trim())
    throw new LguError("INVALID_CERTIFICATE", `${field} is required.`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new LguError("INVALID_CERTIFICATE", `${field} must be a valid date.`);
  return date;
}

function normalizeCertificate(input: LguBusinessRegistrationCredentialInput, now: Date) {
  const issuingAgency = normalizedRequiredString(
    input.issuingAgency,
    "INVALID_CERTIFICATE",
    "Issuing agency",
    40,
  ).toLocaleUpperCase("en-PH");
  const status = normalizedRequiredString(
    input.status,
    "INVALID_CERTIFICATE",
    "Certificate status",
    20,
  ).toLocaleUpperCase("en-PH");
  if (issuingAgency !== "DTI-BNRS" || status !== "REGISTERED")
    throw new LguError(
      "INVALID_CERTIFICATE",
      "A registered DTI-BNRS business-name certificate is required.",
    );
  if (!territorialScopes.has(input.territorialScope))
    throw new LguError("INVALID_CERTIFICATE", "The certificate territorial scope is invalid.");

  const issuedAt = parsedCertificateDate(input.issuedAt, "Certificate issue date");
  const validUntil = parsedCertificateDate(input.validUntil, "Certificate validity date");
  if (issuedAt.getTime() > now.getTime() || issuedAt.getTime() > validUntil.getTime())
    throw new LguError("INVALID_CERTIFICATE", "The certificate dates are inconsistent.");
  if (validUntil.getTime() < now.getTime())
    throw new LguError("INVALID_CERTIFICATE", "The business-name certificate has expired.");

  return {
    certificateNumber: normalizedRequiredString(
      input.certificateNumber,
      "INVALID_CERTIFICATE",
      "Certificate number",
      40,
    ).toLocaleUpperCase("en-PH"),
    issuingAgency: "DTI-BNRS" as const,
    status: "REGISTERED" as const,
    businessName: normalizedRequiredString(
      input.businessName,
      "INVALID_CERTIFICATE",
      "Business name",
      240,
    ),
    ownerName: normalizedRequiredString(
      input.ownerName,
      "INVALID_CERTIFICATE",
      "Certificate owner name",
      240,
    ),
    descriptor: normalizedRequiredString(
      input.descriptor,
      "INVALID_CERTIFICATE",
      "Business descriptor",
      240,
    ),
    territorialScope: input.territorialScope,
    businessAddress: normalizeBusinessAddress(input.businessAddress),
    issuedAt,
    validUntil,
  };
}

function certificateFromRecord(
  application: LguApplicationRecord,
): LguBusinessRegistrationCredentialInput {
  return {
    certificateNumber: application.certificateNumber,
    issuingAgency: application.certificateIssuingAgency,
    businessName: application.certificateBusinessName,
    ownerName: application.certificateOwnerName,
    descriptor: application.certificateDescriptor,
    territorialScope: application.certificateTerritorialScope,
    businessAddress: businessAddressFromRecord(application),
    issuedAt: application.certificateIssuedAt.toISOString(),
    validUntil: application.certificateValidUntil.toISOString(),
    status: application.certificateStatus,
  };
}

function businessAddressFromRecord(application: LguApplicationRecord): LguBusinessAddressInput {
  if (
    application.businessAddressLine1 === null ||
    application.businessBarangay === null ||
    application.businessProvince === null ||
    application.businessRegion === null ||
    application.businessPostalCode === null
  )
    throw new LguError(
      "APPLICATION_CONFLICT",
      "This legacy LGU application has no business-address snapshot and must be restarted.",
    );
  return {
    addressLine1: application.businessAddressLine1,
    ...(application.businessAddressLine2 === null
      ? {}
      : { addressLine2: application.businessAddressLine2 }),
    barangay: application.businessBarangay,
    cityMunicipality: application.city,
    province: application.businessProvince,
    region: application.businessRegion,
    postalCode: application.businessPostalCode,
  };
}

function projectIssuedDocuments(
  application: LguApplicationRecord,
  applicant: LguApplicantInformationRecord,
  payment: LguPaymentRecord | null,
): LguIssuedDocuments | null {
  if (
    application.state !== "COMPLETED" ||
    !application.permitNumber ||
    !application.barangayClearanceNumber ||
    !application.documentsIssuedAt ||
    !application.documentsValidUntil ||
    !payment ||
    payment.status !== "PAID"
  )
    return null;
  const commonDocumentFields = {
    issuingLgu: application.city,
    bnrsCertificateNumber: application.certificateNumber,
    businessName: application.certificateBusinessName,
    ownerName: applicant.ownerName,
    ...(applicant.tin === undefined ? {} : { tin: applicant.tin }),
    businessActivity: application.certificateDescriptor,
    businessAddress: businessAddressFromRecord(application),
    issuedAt: application.documentsIssuedAt.toISOString(),
    validUntil: application.documentsValidUntil.toISOString(),
  };
  return {
    applicationId: application.id,
    businessPermit: {
      permitNumber: application.permitNumber,
      ...commonDocumentFields,
      permitType: "NEW_BUSINESS",
      territorialScope: application.certificateTerritorialScope,
      status: "ACTIVE",
      totalPaid: payment.amount,
    },
    barangayClearance: {
      clearanceNumber: application.barangayClearanceNumber,
      ...commonDocumentFields,
      clearanceType: "BARANGAY_BUSINESS_CLEARANCE",
      status: "APPROVED",
      includedInBusinessPermitFee: true,
    },
  };
}

function snapshotsMatch(
  application: LguApplicationRecord,
  applicant: LguApplicantInformationRecord,
  expected: {
    normalizedCity: string;
    applicant: LguApplicantInformationRecord;
    certificate: ReturnType<typeof normalizeCertificate>;
  },
): boolean {
  return (
    application.normalizedCity === expected.normalizedCity &&
    application.businessAddressLine1 === expected.certificate.businessAddress.addressLine1 &&
    application.businessAddressLine2 ===
      (expected.certificate.businessAddress.addressLine2 ?? null) &&
    application.businessBarangay === expected.certificate.businessAddress.barangay &&
    application.businessProvince === expected.certificate.businessAddress.province &&
    application.businessRegion === expected.certificate.businessAddress.region &&
    application.businessPostalCode === expected.certificate.businessAddress.postalCode &&
    application.certificateNumber === expected.certificate.certificateNumber &&
    application.certificateIssuingAgency === expected.certificate.issuingAgency &&
    application.certificateStatus === expected.certificate.status &&
    application.certificateBusinessName === expected.certificate.businessName &&
    application.certificateOwnerName === expected.certificate.ownerName &&
    application.certificateDescriptor === expected.certificate.descriptor &&
    application.certificateTerritorialScope === expected.certificate.territorialScope &&
    application.certificateIssuedAt.getTime() === expected.certificate.issuedAt.getTime() &&
    application.certificateValidUntil.getTime() === expected.certificate.validUntil.getTime() &&
    applicant.ownerName === expected.applicant.ownerName &&
    applicant.normalizedOwnerName === expected.applicant.normalizedOwnerName &&
    applicant.tin === expected.applicant.tin
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function createLguService(options: LguServiceOptions) {
  const now = options.now ?? (() => new Date());
  const generateId = options.generateId ?? (() => crypto.randomUUID());

  async function loadOwnedApplication(actor: LguActor, applicationId: string) {
    const egovUserId = validateActor(actor);
    if (!isUuid(applicationId))
      throw new LguError("APPLICATION_NOT_FOUND", "The LGU application was not found.");
    const application = await options.repository.getApplication(applicationId);
    if (!application)
      throw new LguError("APPLICATION_NOT_FOUND", "The LGU application was not found.");
    if (application.egovUserId !== egovUserId)
      throw new LguError(
        "APPLICATION_ACCESS_DENIED",
        "The LGU application belongs to another eGov user.",
      );
    const applicant = await options.repository.getApplicantInformation(application.id);
    if (!applicant)
      throw new LguError("APPLICATION_NOT_FOUND", "The LGU applicant record was not found.");
    return { application, applicant, egovUserId };
  }

  async function statusFor(
    application: LguApplicationRecord,
    applicant?: LguApplicantInformationRecord,
  ): Promise<LguApplicationStatus> {
    const resolvedApplicant =
      applicant ?? (await options.repository.getApplicantInformation(application.id));
    if (!resolvedApplicant)
      throw new LguError("APPLICATION_NOT_FOUND", "The LGU applicant record was not found.");
    const payment = await options.repository.getLatestPayment(application.id);
    return {
      applicationId: application.id,
      state: application.state,
      city: application.city,
      applicant: {
        ownerName: resolvedApplicant.ownerName,
        ...(resolvedApplicant.tin === undefined ? {} : { tin: resolvedApplicant.tin }),
      },
      certificate: certificateFromRecord(application),
      fee: getLguPaymentQuote(),
      payment: paymentSummary(payment),
      issuedDocuments: projectIssuedDocuments(application, resolvedApplicant, payment),
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
    };
  }

  function paymentSummary(payment: LguPaymentRecord | null): LguPaymentSummary | null {
    return payment
      ? {
          status: payment.status,
          transactionId: payment.transactionId,
          amount: payment.amount,
          currency: payment.currency,
          paidAt: payment.paidAt?.toISOString() ?? null,
        }
      : null;
  }

  async function paymentSyncResult(
    application: LguApplicationRecord,
    payment?: LguPaymentRecord | null,
  ): Promise<LguPaymentSyncResult> {
    const resolvedPayment =
      payment === undefined ? await options.repository.getLatestPayment(application.id) : payment;
    return {
      status: {
        applicationId: application.id,
        state: application.state,
        payment: paymentSummary(resolvedPayment),
        documentsIssued:
          application.state === "COMPLETED" &&
          application.permitNumber !== null &&
          application.barangayClearanceNumber !== null &&
          resolvedPayment?.status === "PAID",
      },
    };
  }

  function paymentProvider(): LguPaymentProvider {
    if (!options.paymentProvider)
      throw new LguError("PAYMENT_PROVIDER_ERROR", "The LGU payment provider is not configured.");
    return options.paymentProvider;
  }

  function checkoutFromPayment(payment: LguPaymentRecord): LguPaymentCheckout | null {
    if (payment.status !== "PENDING" || !payment.transactionUuid || !payment.checkoutUrl)
      return null;
    return {
      transactionUuid: payment.transactionUuid,
      transactionId: payment.transactionId,
      checkoutUrl: payment.checkoutUrl,
      status: "PENDING",
      amount: payment.amount,
      currency: payment.currency,
    };
  }

  function immutablePaymentFieldsMatch(
    payment: LguPaymentRecord,
    providerTransaction: { transactionId: string; amount: number; currency: string },
  ): boolean {
    return (
      providerTransaction.transactionId === payment.transactionId &&
      providerTransaction.amount === payment.amount &&
      providerTransaction.currency.toUpperCase() === payment.currency.toUpperCase()
    );
  }

  async function createAndActivateProviderPayment(
    application: LguApplicationRecord,
    payment: LguPaymentRecord,
  ) {
    const quote = getLguPaymentQuote();
    const checkout = await paymentProvider().createPayment({
      transactionId: payment.transactionId,
      amount: payment.amount,
      currency: payment.currency,
      callbackUrl: payment.providerCallbackUrl,
      redirectUrl: payment.providerRedirectUrl,
      items: [{ name: `LGU Business Permit — ${application.city}`, amount: quote.totalFee }],
      description: {
        applicationId: application.id,
        bnrsCertificateNumber: application.certificateNumber,
        includesBarangayClearance: true,
      },
    });
    if (
      !checkout.transactionUuid ||
      !checkout.checkoutUrl ||
      (payment.transactionUuid !== null && checkout.transactionUuid !== payment.transactionUuid) ||
      !immutablePaymentFieldsMatch(payment, checkout)
    )
      throw new LguError(
        "PAYMENT_VERIFICATION_FAILED",
        "The created provider transaction does not match the LGU payment.",
      );
    const activated = await options.repository.activatePayment({
      paymentId: payment.id,
      transactionUuid: checkout.transactionUuid,
      checkoutUrl: checkout.checkoutUrl,
      providerStatus: "pending",
      expiresAt: null,
      now: now(),
    });
    if (!activated)
      throw new LguError(
        "PAYMENT_PROVIDER_ERROR",
        "The payment transaction could not be activated.",
      );
    return { checkout, payment: activated };
  }

  function verifyProviderSnapshot(
    payment: LguPaymentRecord,
    snapshot: LguPaymentProviderSnapshot,
  ): void {
    if (
      snapshot.transactionUuid !== payment.transactionUuid ||
      !immutablePaymentFieldsMatch(payment, snapshot)
    )
      throw new LguError(
        "PAYMENT_VERIFICATION_FAILED",
        "The provider transaction does not match this LGU payment.",
      );
  }

  async function providerSnapshot(payment: LguPaymentRecord) {
    if (!payment.transactionUuid)
      throw new LguError(
        "PAYMENT_PROVIDER_ERROR",
        "The payment transaction has not finished being created.",
      );
    try {
      const snapshot = await paymentProvider().getTransaction(payment.transactionUuid);
      verifyProviderSnapshot(payment, snapshot);
      return snapshot;
    } catch (error) {
      if (error instanceof LguError) throw error;
      throw new LguError(
        "PAYMENT_PROVIDER_ERROR",
        "The LGU payment provider could not return the transaction.",
      );
    }
  }

  function documentNumber(prefix: "LGU-BP" | "LGU-BC", issuedAt: Date): string {
    const suffix = generateId().replaceAll("-", "").slice(0, 8).toUpperCase();
    return `${prefix}-${issuedAt.getUTCFullYear()}-${suffix}`;
  }

  function documentValidUntil(issuedAt: Date): Date {
    return new Date(Date.UTC(issuedAt.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
  }

  async function documentsFor(
    application: LguApplicationRecord,
    payment?: LguPaymentRecord | null,
  ): Promise<LguIssuedDocuments | null> {
    const [applicant, resolvedPayment] = await Promise.all([
      options.repository.getApplicantInformation(application.id),
      payment === undefined ? options.repository.getLatestPayment(application.id) : payment,
    ]);
    if (!applicant)
      throw new LguError("APPLICATION_NOT_FOUND", "The LGU applicant record was not found.");
    return projectIssuedDocuments(application, applicant, resolvedPayment);
  }

  async function applyProviderSnapshot(
    payment: LguPaymentRecord,
    snapshot: LguPaymentProviderSnapshot,
  ): Promise<LguPaymentSyncResult> {
    verifyProviderSnapshot(payment, snapshot);
    const authoritativeApplication = await options.repository.getApplication(payment.applicationId);
    if (!authoritativeApplication)
      throw new LguError("APPLICATION_NOT_FOUND", "The LGU application was not found.");
    if (authoritativeApplication.latestPaymentId !== payment.id) {
      return paymentSyncResult(authoritativeApplication);
    }
    const transitionNow = now();

    if (snapshot.status === "PENDING") {
      await options.repository.recordPendingPayment({
        paymentId: payment.id,
        providerStatus: snapshot.providerStatus,
        expiresAt: snapshot.expiresAt,
        now: transitionNow,
      });
      const application = await options.repository.getApplication(payment.applicationId);
      if (!application)
        throw new LguError("APPLICATION_NOT_FOUND", "The LGU application was not found.");
      return paymentSyncResult(application);
    }

    if (snapshot.status !== "PAID") {
      const released = await options.repository.releasePayment({
        applicationId: payment.applicationId,
        paymentId: payment.id,
        status: snapshot.status,
        providerStatus: snapshot.providerStatus,
        expiresAt: snapshot.expiresAt,
        now: transitionNow,
      });
      if (!released) {
        const refreshed = await options.repository.getApplication(payment.applicationId);
        if (!refreshed) return invalidState(payment.applicationId);
        return paymentSyncResult(refreshed);
      }
      return paymentSyncResult(released.application, released.payment);
    }

    const currentApplication = await options.repository.getApplication(payment.applicationId);
    if (!currentApplication)
      throw new LguError("APPLICATION_NOT_FOUND", "The LGU application was not found.");
    const issuedAt = currentApplication.documentsIssuedAt ?? transitionNow;
    const completed = await options.repository.completePayment({
      applicationId: payment.applicationId,
      paymentId: payment.id,
      providerStatus: snapshot.providerStatus,
      permitNumber: currentApplication.permitNumber ?? documentNumber("LGU-BP", issuedAt),
      barangayClearanceNumber:
        currentApplication.barangayClearanceNumber ?? documentNumber("LGU-BC", issuedAt),
      paidAt: snapshot.paidAt ?? transitionNow,
      issuedAt,
      validUntil: currentApplication.documentsValidUntil ?? documentValidUntil(issuedAt),
      now: transitionNow,
    });
    if (!completed) {
      const refreshed = await options.repository.getApplication(payment.applicationId);
      if (!refreshed) return invalidState(payment.applicationId);
      return paymentSyncResult(refreshed);
    }
    return paymentSyncResult(completed.application, completed.payment);
  }

  async function invalidState(applicationId: string): Promise<never> {
    const application = await options.repository.getApplication(applicationId);
    throw new LguError(
      "INVALID_APPLICATION_STATE",
      `This operation is not allowed while the application is ${application?.state ?? "unavailable"}.`,
      application ? { state: application.state } : undefined,
    );
  }

  return {
    async startOrResumeApplication(input: {
      actor: LguActor;
      applicant: LguApplicantInformationInput;
      certificate: LguBusinessRegistrationCredentialInput;
    }) {
      const currentTime = now();
      const egovUserId = validateActor(input.actor);
      const applicant = normalizeApplicant(input.applicant);
      const certificate = normalizeCertificate(input.certificate, currentTime);
      if (comparisonKey(certificate.ownerName) !== applicant.normalizedOwnerName)
        throw new LguError(
          "CERTIFICATE_OWNER_MISMATCH",
          "The business-name certificate belongs to another owner.",
        );
      const city = certificate.businessAddress.cityMunicipality;
      const normalizedCity = comparisonKey(city);
      const aggregate = await options.repository.startOrResumeApplication({
        egovUserId,
        city,
        normalizedCity,
        certificate,
        applicant,
        now: currentTime,
      });
      if (
        !snapshotsMatch(aggregate.application, aggregate.applicant, {
          normalizedCity,
          certificate,
          applicant,
        })
      )
        throw new LguError(
          "APPLICATION_CONFLICT",
          "An LGU application already exists for this certificate and city with different details.",
        );
      return statusFor(aggregate.application, aggregate.applicant);
    },
    async getStatus(input: { actor: LguActor; applicationId: string }) {
      const { application, applicant } = await loadOwnedApplication(
        input.actor,
        input.applicationId,
      );
      return statusFor(application, applicant);
    },
    async getPaymentQuote(input: { actor: LguActor; applicationId: string }) {
      const { application } = await loadOwnedApplication(input.actor, input.applicationId);
      if (application.state === "ABANDONED")
        throw new LguError("PAYMENT_NOT_READY", "The abandoned application cannot be paid.");
      return getLguPaymentQuote();
    },
    async createPayment(input: {
      actor: LguActor;
      applicationId: string;
      callbackUrl: string;
      redirectUrl: string;
    }) {
      const { application, egovUserId } = await loadOwnedApplication(
        input.actor,
        input.applicationId,
      );
      if (application.certificateValidUntil.getTime() < now().getTime())
        throw new LguError(
          "PAYMENT_NOT_READY",
          "The business-name certificate expired before payment.",
        );

      let paymentAttempt;
      if (application.state === "PAYMENT_PENDING") {
        const current = await options.repository.getCurrentPayment(application.id);
        const reusable = current ? checkoutFromPayment(current) : null;
        if (reusable) return reusable;
        if (!current)
          throw new LguError("PAYMENT_PROVIDER_ERROR", "The payment transaction is unavailable.");
        paymentAttempt = { application, payment: current };
      } else if (application.state !== "PAYMENT_READY") {
        throw new LguError("PAYMENT_NOT_READY", "The application is not ready for payment.");
      }

      const quote = getLguPaymentQuote();
      if (!paymentAttempt) {
        try {
          paymentAttempt = await options.repository.beginPayment({
            applicationId: application.id,
            egovUserId,
            transactionId: `LGU-PAY-${generateId()}`,
            amount: quote.totalFee,
            currency: quote.currency,
            providerCallbackUrl: input.callbackUrl,
            providerRedirectUrl: input.redirectUrl,
            now: now(),
          });
        } catch (error) {
          if (error instanceof LguRepositoryConflict) {
            const current = await options.repository.getCurrentPayment(application.id);
            const reusable = current ? checkoutFromPayment(current) : null;
            if (reusable) return reusable;
            throw new LguError(
              "PAYMENT_PROVIDER_ERROR",
              "The payment transaction is still being created.",
            );
          }
          throw error;
        }
        if (!paymentAttempt) return invalidState(application.id);
      }

      try {
        return (await createAndActivateProviderPayment(application, paymentAttempt.payment))
          .checkout;
      } catch (error) {
        if (error instanceof LguError) throw error;
        throw new LguError(
          "PAYMENT_PROVIDER_ERROR",
          "The payment transaction could not be created or recovered. Retry with the same application.",
        );
      }
    },
    async syncPaymentStatus(input: { transactionUuid: string }) {
      if (!isUuid(input.transactionUuid))
        throw new LguError("PAYMENT_NOT_FOUND", "The LGU payment was not found.");
      let payment = await options.repository.getPaymentByTransactionUuid(input.transactionUuid);
      if (payment) return applyProviderSnapshot(payment, await providerSnapshot(payment));

      let snapshot: LguPaymentProviderSnapshot;
      try {
        snapshot = await paymentProvider().getTransaction(input.transactionUuid);
      } catch {
        throw new LguError("PAYMENT_NOT_FOUND", "The LGU payment was not found.");
      }
      payment = await options.repository.getPaymentByTransactionId(snapshot.transactionId);
      if (
        !payment ||
        snapshot.transactionUuid !== input.transactionUuid ||
        !immutablePaymentFieldsMatch(payment, snapshot)
      )
        throw new LguError("PAYMENT_NOT_FOUND", "The LGU payment was not found.");
      if (payment.transactionUuid !== null) {
        if (payment.transactionUuid !== input.transactionUuid)
          throw new LguError("PAYMENT_NOT_FOUND", "The LGU payment was not found.");
        return applyProviderSnapshot(payment, snapshot);
      }
      if (payment.status !== "CREATING")
        throw new LguError("PAYMENT_NOT_FOUND", "The LGU payment was not found.");
      const activated = await options.repository.activatePayment({
        paymentId: payment.id,
        transactionUuid: snapshot.transactionUuid,
        checkoutUrl: null,
        providerStatus: snapshot.providerStatus,
        expiresAt: snapshot.expiresAt,
        now: now(),
      });
      if (!activated)
        throw new LguError(
          "PAYMENT_PROVIDER_ERROR",
          "The recovered payment transaction could not be activated.",
        );
      return applyProviderSnapshot(activated, snapshot);
    },
    async listIssuedDocuments(input: { actor: LguActor }) {
      const applications = await options.repository.listCompletedApplications(
        validateActor(input.actor),
      );
      const documents = await Promise.all(
        applications.map((application) => documentsFor(application)),
      );
      return documents.filter((value): value is LguIssuedDocuments => value !== null);
    },
    async getIssuedDocuments(input: { actor: LguActor; applicationId: string }) {
      const { application, applicant } = await loadOwnedApplication(
        input.actor,
        input.applicationId,
      );
      const payment = await options.repository.getLatestPayment(application.id);
      const documents = projectIssuedDocuments(application, applicant, payment);
      if (!documents)
        throw new LguError(
          "ISSUED_DOCUMENTS_NOT_FOUND",
          "The permit and barangay clearance have not been issued.",
        );
      return documents;
    },
    async abandonApplication(input: { actor: LguActor; applicationId: string }) {
      const { application, applicant, egovUserId } = await loadOwnedApplication(
        input.actor,
        input.applicationId,
      );
      if (application.state === "ABANDONED") return statusFor(application);
      if (application.state === "COMPLETED") return invalidState(application.id);

      let abandonableApplication = application;
      if (application.state === "PAYMENT_PENDING") {
        let payment = await options.repository.getCurrentPayment(application.id);
        if (!payment)
          throw new LguError("PAYMENT_NOT_FOUND", "The pending LGU payment was not found.");
        if (!payment.transactionUuid) {
          try {
            payment = (await createAndActivateProviderPayment(application, payment)).payment;
          } catch (error) {
            if (error instanceof LguError) throw error;
            throw new LguError(
              "PAYMENT_PROVIDER_ERROR",
              "The creating payment could not be recovered before abandonment.",
            );
          }
        }
        let snapshot = await providerSnapshot(payment);
        if (snapshot.status === "PAID") {
          await applyProviderSnapshot(payment, snapshot);
          const completed = await options.repository.getApplication(application.id);
          return completed ? statusFor(completed, applicant) : invalidState(application.id);
        }
        if (snapshot.status === "PENDING") {
          try {
            await paymentProvider().voidTransaction(snapshot.transactionUuid);
          } catch {
            throw new LguError(
              "PAYMENT_PROVIDER_ERROR",
              "The pending payment could not be voided.",
            );
          }
          snapshot = await providerSnapshot(payment);
          if (snapshot.status === "PENDING")
            throw new LguError(
              "PAYMENT_PROVIDER_ERROR",
              "The provider has not confirmed that the payment is voided.",
            );
          if (snapshot.status === "PAID") {
            await applyProviderSnapshot(payment, snapshot);
            const completed = await options.repository.getApplication(application.id);
            return completed ? statusFor(completed, applicant) : invalidState(application.id);
          }
        }
        const released = await applyProviderSnapshot(payment, snapshot);
        const refreshed = await options.repository.getApplication(application.id);
        if (!refreshed) return invalidState(application.id);
        abandonableApplication = refreshed;
        if (released.status.state === "COMPLETED") return statusFor(refreshed, applicant);
      }

      const updated = await options.repository.updateApplication({
        applicationId: abandonableApplication.id,
        egovUserId,
        expectedStates: ["PAYMENT_READY"],
        patch: { state: "ABANDONED", abandonedAt: now() },
        now: now(),
      });
      return updated ? statusFor(updated) : invalidState(abandonableApplication.id);
    },
  };
}

export type LguService = ReturnType<typeof createLguService>;
