import {
  BNRS_BUSINESS_SCOPES,
  BNRS_DESCRIPTORS,
  BNRS_TERMS_AND_CONDITIONS,
  getBusinessNameRequirements,
  getBusinessScopes,
} from "./constants.js";
import { BnrsError } from "./errors.js";
import {
  BnrsRepositoryConflict,
  type BnrsApplicationRecord,
  type BnrsPaymentRecord,
  type BnrsRepository,
} from "./repository.js";
import type {
  BnrsActor,
  BnrsApplicationState,
  BnrsApplicationStatus,
  BnrsBusinessAddressDetails,
  BnrsBusinessAddressInput,
  BnrsBusinessScope,
  BnrsBusinessScopeId,
  BnrsCertificate,
  BnrsCompletedStep,
  BnrsNextStep,
  BnrsOwnerInformationInput,
  BnrsPaymentCheckout,
  BnrsPaymentProvider,
  BnrsPaymentProviderSnapshot,
  BnrsPaymentRegistrationReceipt,
  BnrsPaymentSyncResult,
  BnrsRegisteredBusiness,
} from "./types.js";

export interface BnrsServiceOptions {
  repository: BnrsRepository;
  paymentProvider?: BnrsPaymentProvider;
  now?: () => Date;
  generateId?: () => string;
}

const nextSteps: Record<Exclude<BnrsApplicationState, "COMPLETED" | "ABANDONED">, BnrsNextStep> = {
  TERMS_PENDING: "TERMS_AND_CONDITIONS",
  OWNER_INFORMATION_PENDING: "OWNER_INFORMATION",
  BUSINESS_NAME_PENDING: "BUSINESS_NAME",
  SCOPE_PENDING: "BUSINESS_SCOPE",
  BUSINESS_ADDRESS_PENDING: "BUSINESS_ADDRESS",
  PAYMENT_READY: "PAYMENT",
  PAYMENT_PENDING: "PAYMENT",
};

const advancedFromOwner = new Set<BnrsApplicationState>([
  "BUSINESS_NAME_PENDING",
  "SCOPE_PENDING",
  "BUSINESS_ADDRESS_PENDING",
  "PAYMENT_READY",
  "PAYMENT_PENDING",
  "COMPLETED",
]);

const advancedFromTerms = new Set<BnrsApplicationState>([
  "OWNER_INFORMATION_PENDING",
  ...advancedFromOwner,
]);

const descriptorById: ReadonlyMap<string, (typeof BNRS_DESCRIPTORS)[number]> = new Map(
  BNRS_DESCRIPTORS.map((descriptor) => [descriptor.id, descriptor]),
);
const scopeById = new Map(BNRS_BUSINESS_SCOPES.map((scope) => [scope.id, scope]));

function normalizedRequiredString(value: string, field: string, maximum: number): string {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > maximum)
    throw new BnrsError(
      "INVALID_BUSINESS_NAME",
      `${field} must be between 1 and ${maximum} characters.`,
    );
  return normalized;
}

function normalizedOptionalString(value: string | undefined, maximum = 200): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!normalized) return undefined;
  if (normalized.length > maximum)
    throw new BnrsError("INVALID_OWNER_INFORMATION", "An owner-information value is too long.");
  return normalized;
}

function normalizeOwner(owner: BnrsOwnerInformationInput): BnrsOwnerInformationInput {
  const citizenship = normalizedOptionalString(owner.citizenship);
  const firstName = normalizedOptionalString(owner.firstName);
  const middleName = normalizedOptionalString(owner.middleName);
  const lastName = normalizedOptionalString(owner.lastName);
  const suffix = normalizedOptionalString(owner.suffix, 40);
  const birthDate = normalizedOptionalString(owner.birthDate, 10);
  const gender = normalizedOptionalString(owner.gender, 40);

  if (birthDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate))
    throw new BnrsError("INVALID_OWNER_INFORMATION", "Birth date must use YYYY-MM-DD format.");

  return {
    ...(citizenship === undefined ? {} : { citizenship }),
    ...(firstName === undefined ? {} : { firstName }),
    ...(middleName === undefined ? {} : { middleName }),
    ...(lastName === undefined ? {} : { lastName }),
    ...(suffix === undefined ? {} : { suffix }),
    ...(birthDate === undefined ? {} : { birthDate }),
    ...(gender === undefined ? {} : { gender }),
  };
}

function normalizedAddressString(value: string, field: string, maximum: number): string {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > maximum)
    throw new BnrsError(
      "INVALID_BUSINESS_ADDRESS",
      `${field} must be between 1 and ${maximum} characters.`,
    );
  return normalized;
}

function normalizeBusinessAddress(address: BnrsBusinessAddressInput): BnrsBusinessAddressInput {
  if (address.source !== "EGOV_RESIDENTIAL" && address.source !== "USER_PROVIDED")
    throw new BnrsError("INVALID_BUSINESS_ADDRESS", "Select a supported business-address source.");
  const addressLine1 = normalizedAddressString(address.addressLine1, "Address line 1", 300);
  const addressLine2 = address.addressLine2
    ? normalizedAddressString(address.addressLine2, "Address line 2", 200)
    : undefined;
  const barangay = normalizedAddressString(address.barangay, "Barangay", 120);
  const cityMunicipality = normalizedAddressString(
    address.cityMunicipality,
    "City/municipality",
    120,
  );
  const province = normalizedAddressString(address.province, "Province", 120);
  const region = normalizedAddressString(address.region, "Region", 120);
  const postalCode = normalizedAddressString(address.postalCode, "Postal code", 10);
  if (!/^\d{4}$/.test(postalCode))
    throw new BnrsError(
      "INVALID_BUSINESS_ADDRESS",
      "Postal code must contain exactly four digits.",
    );
  return {
    source: address.source,
    addressLine1,
    ...(addressLine2 === undefined ? {} : { addressLine2 }),
    barangay,
    cityMunicipality,
    province,
    region,
    postalCode,
  };
}

function sameBusinessAddress(
  left: BnrsBusinessAddressInput,
  right: BnrsBusinessAddressInput,
): boolean {
  return (
    left.source === right.source &&
    left.addressLine1 === right.addressLine1 &&
    left.addressLine2 === right.addressLine2 &&
    left.barangay === right.barangay &&
    left.cityMunicipality === right.cityMunicipality &&
    left.province === right.province &&
    left.region === right.region &&
    left.postalCode === right.postalCode
  );
}

function certificateBusinessAddress(address: BnrsBusinessAddressInput): BnrsBusinessAddressDetails {
  return {
    addressLine1: address.addressLine1,
    ...(address.addressLine2 === undefined ? {} : { addressLine2: address.addressLine2 }),
    barangay: address.barangay,
    cityMunicipality: address.cityMunicipality,
    province: address.province,
    region: address.region,
    postalCode: address.postalCode,
  };
}

function descriptorDisplayLabel(label: string): string {
  return label
    .split(" ")
    .map((word) => {
      if (word === "&" || /^(?:[A-Z]\.){2,}$/.test(word)) return word;
      return word
        .split("-")
        .map((part) => (part ? `${part[0]}${part.slice(1).toLowerCase()}` : part))
        .join("-");
    })
    .join(" ");
}

export function normalizeBnrsBusinessName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleUpperCase("en-PH");
}

function projectCompletedSteps(
  application: BnrsApplicationRecord,
  ownerStored: boolean,
  businessAddressStored: boolean,
): BnrsCompletedStep[] {
  const steps: BnrsCompletedStep[] = [];
  if (application.termsAcceptedAt) steps.push("TERMS_AND_CONDITIONS");
  if (ownerStored) steps.push("OWNER_INFORMATION");
  if (application.proposedBusinessName) steps.push("BUSINESS_NAME");
  if (application.scope) steps.push("BUSINESS_SCOPE");
  if (businessAddressStored) steps.push("BUSINESS_ADDRESS");
  if (application.state === "COMPLETED") steps.push("PAYMENT");
  return steps;
}

function scopeFromApplication(application: BnrsApplicationRecord): BnrsBusinessScope | null {
  if (
    !application.scope ||
    application.registrationFee === null ||
    application.documentaryStampTax === null ||
    application.totalFee === null
  )
    return null;
  const catalogScope = scopeById.get(application.scope);
  if (!catalogScope) return null;
  return {
    id: application.scope,
    label: catalogScope.label,
    registrationFee: application.registrationFee,
    documentaryStampTax: application.documentaryStampTax,
    totalFee: application.totalFee,
  };
}

function projectStatus(
  application: BnrsApplicationRecord,
  ownerStored: boolean,
  businessAddress: BnrsBusinessAddressInput | null,
  payment: BnrsPaymentRecord | null,
): BnrsApplicationStatus {
  const terminal = application.state === "COMPLETED" || application.state === "ABANDONED";
  return {
    applicationId: application.id,
    state: application.state,
    completedSteps: projectCompletedSteps(application, ownerStored, businessAddress !== null),
    nextStep: terminal
      ? null
      : application.state === "PAYMENT_READY" && businessAddress === null
        ? "BUSINESS_ADDRESS"
        : nextSteps[application.state as keyof typeof nextSteps],
    termsAcceptedAt: application.termsAcceptedAt?.toISOString() ?? null,
    ownerInformation: { stored: ownerStored },
    businessName:
      application.dominantName &&
      application.descriptorId &&
      application.descriptorLabel &&
      application.proposedBusinessName
        ? {
            dominantName: application.dominantName,
            descriptorId: application.descriptorId,
            descriptor: application.descriptorLabel,
            proposedBusinessName: application.proposedBusinessName,
          }
        : null,
    scope: scopeFromApplication(application),
    businessAddress: {
      stored: businessAddress !== null,
      source: businessAddress?.source ?? null,
    },
    payment: payment
      ? {
          status: payment.status,
          transactionId: payment.transactionId,
          amount: payment.amount,
          currency: payment.currency,
          paidAt: payment.paidAt?.toISOString() ?? null,
        }
      : null,
    registration:
      application.referenceCode && application.issuedAt
        ? {
            referenceCode: application.referenceCode,
            issuedAt: application.issuedAt.toISOString(),
          }
        : null,
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  };
}

function projectRegisteredBusiness(
  application: BnrsApplicationRecord,
): BnrsRegisteredBusiness | null {
  if (
    application.state !== "COMPLETED" ||
    !application.referenceCode ||
    !application.certificateNumber ||
    !application.validUntil ||
    !application.proposedBusinessName ||
    !application.descriptorLabel ||
    !application.scope ||
    !application.issuedAt
  )
    return null;
  return {
    applicationId: application.id,
    referenceCode: application.referenceCode,
    certificateNumber: application.certificateNumber,
    businessName: application.proposedBusinessName,
    descriptor: application.descriptorLabel,
    scope: application.scope,
    issuedAt: application.issuedAt.toISOString(),
  };
}

function validateActor(actor: BnrsActor): string {
  const egovUserId = actor.egovUserId.trim();
  if (!egovUserId) throw new BnrsError("INVALID_ACTOR", "An authenticated eGov user is required.");
  return egovUserId;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function createBnrsService(options: BnrsServiceOptions) {
  const now = options.now ?? (() => new Date());
  const generateId = options.generateId ?? (() => crypto.randomUUID());

  async function loadOwnedApplication(actor: BnrsActor, applicationId: string) {
    const egovUserId = validateActor(actor);
    if (!isUuid(applicationId))
      throw new BnrsError("APPLICATION_NOT_FOUND", "The BNRS application was not found.");
    const application = await options.repository.getApplication(applicationId);
    if (!application)
      throw new BnrsError("APPLICATION_NOT_FOUND", "The BNRS application was not found.");
    if (application.egovUserId !== egovUserId)
      throw new BnrsError(
        "APPLICATION_ACCESS_DENIED",
        "The BNRS application belongs to another eGov user.",
      );
    return { application, egovUserId };
  }

  async function statusFor(application: BnrsApplicationRecord) {
    const [ownerStored, businessAddress, payment] = await Promise.all([
      options.repository.hasOwnerInformation(application.id),
      options.repository.getBusinessAddress(application.id),
      options.repository.getLatestPayment(application.id),
    ]);
    return projectStatus(application, ownerStored, businessAddress, payment);
  }

  function paymentProvider(): BnrsPaymentProvider {
    if (!options.paymentProvider)
      throw new BnrsError("PAYMENT_PROVIDER_ERROR", "The payment provider is not configured.");
    return options.paymentProvider;
  }

  function checkoutFromPayment(payment: BnrsPaymentRecord): BnrsPaymentCheckout | null {
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

  function verifyProviderSnapshot(
    payment: BnrsPaymentRecord,
    snapshot: BnrsPaymentProviderSnapshot,
  ): void {
    if (
      snapshot.transactionUuid !== payment.transactionUuid ||
      snapshot.transactionId !== payment.transactionId ||
      snapshot.amount !== payment.amount ||
      snapshot.currency.toUpperCase() !== payment.currency.toUpperCase()
    )
      throw new BnrsError(
        "PAYMENT_VERIFICATION_FAILED",
        "The provider transaction does not match this BNRS payment.",
      );
  }

  async function providerSnapshot(payment: BnrsPaymentRecord) {
    if (!payment.transactionUuid)
      throw new BnrsError(
        "PAYMENT_PROVIDER_ERROR",
        "The payment transaction has not finished being created.",
      );
    try {
      const snapshot = await paymentProvider().getTransaction(payment.transactionUuid);
      verifyProviderSnapshot(payment, snapshot);
      return snapshot;
    } catch (error) {
      if (error instanceof BnrsError) throw error;
      throw new BnrsError(
        "PAYMENT_PROVIDER_ERROR",
        "The payment provider could not return the transaction.",
      );
    }
  }

  function registrationIdentifier(prefix: "BNRS" | "BNN", issuedAt: Date): string {
    const date = issuedAt.toISOString().slice(0, 10).replaceAll("-", "");
    const suffix = generateId().replaceAll("-", "").slice(0, 8).toUpperCase();
    return `${prefix}-${date}-${suffix}`;
  }

  function certificateValidUntil(issuedAt: Date): Date {
    const validUntil = new Date(issuedAt);
    const issuedMonth = issuedAt.getUTCMonth();
    validUntil.setUTCFullYear(issuedAt.getUTCFullYear() + 5);
    if (validUntil.getUTCMonth() !== issuedMonth) validUntil.setUTCDate(0);
    return validUntil;
  }

  async function certificateFor(
    application: BnrsApplicationRecord,
  ): Promise<BnrsCertificate | null> {
    if (
      application.state !== "COMPLETED" ||
      !application.certificateNumber ||
      !application.proposedBusinessName ||
      !application.descriptorLabel ||
      !application.scope ||
      !application.issuedAt ||
      !application.validUntil
    )
      return null;
    const [owner, businessAddress] = await Promise.all([
      options.repository.getOwnerInformation(application.id),
      options.repository.getBusinessAddress(application.id),
    ]);
    if (!businessAddress) return null;
    const ownerName = [owner?.firstName, owner?.middleName, owner?.lastName, owner?.suffix]
      .filter((value): value is string => Boolean(value))
      .join(" ");
    return {
      certificateNumber: application.certificateNumber,
      issuingAgency: "DTI-BNRS",
      businessName: application.proposedBusinessName,
      ownerName,
      descriptor: application.descriptorLabel,
      territorialScope: application.scope,
      businessAddress: certificateBusinessAddress(businessAddress),
      issuedAt: application.issuedAt.toISOString(),
      validUntil: application.validUntil.toISOString(),
      status: "REGISTERED",
    };
  }

  function registrationReceiptFor(
    application: BnrsApplicationRecord,
  ): BnrsPaymentRegistrationReceipt | null {
    if (
      application.state !== "COMPLETED" ||
      !application.referenceCode ||
      !application.certificateNumber ||
      !application.issuedAt ||
      !application.validUntil
    )
      return null;
    return {
      referenceCode: application.referenceCode,
      certificateNumber: application.certificateNumber,
      issuedAt: application.issuedAt.toISOString(),
    };
  }

  async function applyProviderSnapshot(
    payment: BnrsPaymentRecord,
    snapshot: BnrsPaymentProviderSnapshot,
  ): Promise<BnrsPaymentSyncResult> {
    verifyProviderSnapshot(payment, snapshot);
    const authoritativeApplication = await options.repository.getApplication(payment.applicationId);
    if (!authoritativeApplication)
      throw new BnrsError("APPLICATION_NOT_FOUND", "The BNRS application was not found.");
    if (authoritativeApplication.latestPaymentId !== payment.id) {
      const latestPayment = await options.repository.getLatestPayment(payment.applicationId);
      return {
        status: await statusFor(authoritativeApplication),
        registration: latestPayment ? registrationReceiptFor(authoritativeApplication) : null,
      };
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
        throw new BnrsError("APPLICATION_NOT_FOUND", "The BNRS application was not found.");
      return { status: await statusFor(application), registration: null };
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
        const latestPayment = await options.repository.getLatestPayment(payment.applicationId);
        return {
          status: await statusFor(refreshed),
          registration: latestPayment ? registrationReceiptFor(refreshed) : null,
        };
      }
      return { status: await statusFor(released.application), registration: null };
    }

    const currentApplication = await options.repository.getApplication(payment.applicationId);
    if (!currentApplication)
      throw new BnrsError("APPLICATION_NOT_FOUND", "The BNRS application was not found.");
    const issuedAt = currentApplication.issuedAt ?? transitionNow;
    const completed = await options.repository.completePayment({
      applicationId: payment.applicationId,
      paymentId: payment.id,
      providerStatus: snapshot.providerStatus,
      referenceCode: currentApplication.referenceCode ?? registrationIdentifier("BNRS", issuedAt),
      certificateNumber:
        currentApplication.certificateNumber ?? registrationIdentifier("BNN", issuedAt),
      paidAt: snapshot.paidAt ?? transitionNow,
      issuedAt,
      validUntil: currentApplication.validUntil ?? certificateValidUntil(issuedAt),
      now: transitionNow,
    });
    if (!completed) {
      const refreshed = await options.repository.getApplication(payment.applicationId);
      if (!refreshed) return invalidState(payment.applicationId);
      const latestPayment = await options.repository.getLatestPayment(payment.applicationId);
      return {
        status: await statusFor(refreshed),
        registration: latestPayment ? registrationReceiptFor(refreshed) : null,
      };
    }
    return {
      status: await statusFor(completed.application),
      registration: registrationReceiptFor(completed.application),
    };
  }

  async function invalidState(applicationId: string): Promise<never> {
    const current = await options.repository.getApplication(applicationId);
    throw new BnrsError(
      "INVALID_APPLICATION_STATE",
      `This operation is not allowed while the application is ${current?.state ?? "unavailable"}.`,
      current ? { state: current.state } : undefined,
    );
  }

  return {
    getTermsAndConditions() {
      return BNRS_TERMS_AND_CONDITIONS;
    },
    getBusinessNameRequirements,
    getBusinessScopes,
    async listRegisteredBusinesses(input: { actor: BnrsActor }) {
      const applications = await options.repository.listCompletedApplications(
        validateActor(input.actor),
      );
      return applications
        .map(projectRegisteredBusiness)
        .filter((registration): registration is BnrsRegisteredBusiness => registration !== null);
    },
    async getCertificate(input: { actor: BnrsActor; certificateNumber: string }) {
      const application = await options.repository.getCompletedApplicationByCertificateNumber({
        egovUserId: validateActor(input.actor),
        certificateNumber: input.certificateNumber.normalize("NFKC").trim().toUpperCase(),
      });
      const certificate = application ? await certificateFor(application) : null;
      if (!certificate)
        throw new BnrsError(
          "CERTIFICATE_NOT_FOUND",
          "The BNRS certificate was not found for this eGov user.",
        );
      return certificate;
    },
    async startOrResumeApplication(input: { actor: BnrsActor }) {
      const application = await options.repository.startOrResumeApplication(
        validateActor(input.actor),
        now(),
      );
      return statusFor(application);
    },
    async getStatus(input: { actor: BnrsActor; applicationId: string }) {
      const { application } = await loadOwnedApplication(input.actor, input.applicationId);
      return statusFor(application);
    },
    async acceptTermsAndConditions(input: { actor: BnrsActor; applicationId: string }) {
      const { application, egovUserId } = await loadOwnedApplication(
        input.actor,
        input.applicationId,
      );
      if (application.state !== "TERMS_PENDING") {
        if (application.termsAcceptedAt && advancedFromTerms.has(application.state))
          return statusFor(application);
        return invalidState(application.id);
      }
      const updated = await options.repository.updateApplication({
        applicationId: application.id,
        egovUserId,
        expectedStates: ["TERMS_PENDING"],
        patch: { state: "OWNER_INFORMATION_PENDING", termsAcceptedAt: now() },
        now: now(),
      });
      return updated ? statusFor(updated) : invalidState(application.id);
    },
    async setOwnerInformation(input: {
      actor: BnrsActor;
      applicationId: string;
      owner: BnrsOwnerInformationInput;
    }) {
      const { application, egovUserId } = await loadOwnedApplication(
        input.actor,
        input.applicationId,
      );
      if (application.state !== "OWNER_INFORMATION_PENDING") {
        if (advancedFromOwner.has(application.state)) return statusFor(application);
        return invalidState(application.id);
      }
      const updated = await options.repository.saveOwnerInformationAndAdvance({
        applicationId: application.id,
        egovUserId,
        expectedState: "OWNER_INFORMATION_PENDING",
        owner: normalizeOwner(input.owner),
        now: now(),
      });
      return updated ? statusFor(updated) : invalidState(application.id);
    },
    async setBusinessName(input: {
      actor: BnrsActor;
      applicationId: string;
      dominantName: string;
      descriptorId: string;
    }) {
      const { application, egovUserId } = await loadOwnedApplication(
        input.actor,
        input.applicationId,
      );
      const descriptor = descriptorById.get(input.descriptorId);
      if (!descriptor)
        throw new BnrsError("INVALID_DESCRIPTOR", "Select a descriptor from the BNRS catalog.");
      const dominantName = normalizedRequiredString(input.dominantName, "Dominant name", 100);
      if (!/[\p{L}\p{N}]/u.test(dominantName))
        throw new BnrsError(
          "INVALID_BUSINESS_NAME",
          "The dominant name must contain a letter or number.",
        );
      const proposedBusinessName = `${dominantName} ${descriptorDisplayLabel(descriptor.label)}`;
      if (proposedBusinessName.length > 200)
        throw new BnrsError(
          "INVALID_BUSINESS_NAME",
          "The proposed business name must not exceed 200 characters.",
        );
      const normalizedBusinessName = normalizeBnrsBusinessName(proposedBusinessName);
      if (
        await options.repository.isBusinessNameReserved({
          normalizedBusinessName,
          excludeApplicationId: application.id,
        })
      )
        throw new BnrsError(
          "BUSINESS_NAME_UNAVAILABLE",
          "The proposed business name is not available.",
        );

      if (application.state === "PAYMENT_PENDING" || application.state === "COMPLETED") {
        if (application.normalizedBusinessName === normalizedBusinessName)
          return statusFor(application);
        return invalidState(application.id);
      }
      if (
        application.state !== "BUSINESS_NAME_PENDING" &&
        application.state !== "SCOPE_PENDING" &&
        application.state !== "BUSINESS_ADDRESS_PENDING" &&
        application.state !== "PAYMENT_READY"
      )
        return invalidState(application.id);

      const updated = await options.repository.updateApplication({
        applicationId: application.id,
        egovUserId,
        expectedStates: [
          "BUSINESS_NAME_PENDING",
          "SCOPE_PENDING",
          "BUSINESS_ADDRESS_PENDING",
          "PAYMENT_READY",
        ],
        patch: {
          dominantName,
          descriptorId: descriptor.id,
          descriptorLabel: descriptor.label,
          proposedBusinessName,
          normalizedBusinessName,
          state:
            application.state === "BUSINESS_NAME_PENDING" ? "SCOPE_PENDING" : application.state,
        },
        now: now(),
      });
      return updated ? statusFor(updated) : invalidState(application.id);
    },
    async setBusinessScope(input: {
      actor: BnrsActor;
      applicationId: string;
      scopeId: BnrsBusinessScopeId;
    }) {
      const { application, egovUserId } = await loadOwnedApplication(
        input.actor,
        input.applicationId,
      );
      const scope = scopeById.get(input.scopeId);
      if (!scope) throw new BnrsError("INVALID_SCOPE", "Select a supported business scope.");
      if (application.state === "PAYMENT_PENDING" || application.state === "COMPLETED") {
        if (application.scope === scope.id) return statusFor(application);
        return invalidState(application.id);
      }
      if (
        application.state !== "SCOPE_PENDING" &&
        application.state !== "BUSINESS_ADDRESS_PENDING" &&
        application.state !== "PAYMENT_READY"
      )
        return invalidState(application.id);

      const updated = await options.repository.updateApplication({
        applicationId: application.id,
        egovUserId,
        expectedStates: ["SCOPE_PENDING", "BUSINESS_ADDRESS_PENDING", "PAYMENT_READY"],
        patch: {
          state:
            application.state === "SCOPE_PENDING" ? "BUSINESS_ADDRESS_PENDING" : application.state,
          scope: scope.id,
          registrationFee: scope.registrationFee,
          documentaryStampTax: scope.documentaryStampTax,
          totalFee: scope.totalFee,
        },
        now: now(),
      });
      return updated ? statusFor(updated) : invalidState(application.id);
    },
    async setBusinessAddress(input: {
      actor: BnrsActor;
      applicationId: string;
      address: BnrsBusinessAddressInput;
    }) {
      const { application, egovUserId } = await loadOwnedApplication(
        input.actor,
        input.applicationId,
      );
      const address = normalizeBusinessAddress(input.address);
      if (application.state === "PAYMENT_PENDING" || application.state === "COMPLETED") {
        const existing = await options.repository.getBusinessAddress(application.id);
        if (existing && sameBusinessAddress(existing, address)) return statusFor(application);
        return invalidState(application.id);
      }
      if (application.state !== "BUSINESS_ADDRESS_PENDING" && application.state !== "PAYMENT_READY")
        return invalidState(application.id);

      const updated = await options.repository.saveBusinessAddressAndAdvance({
        applicationId: application.id,
        egovUserId,
        expectedStates: ["BUSINESS_ADDRESS_PENDING", "PAYMENT_READY"],
        address,
        now: now(),
      });
      return updated ? statusFor(updated) : invalidState(application.id);
    },
    async getPaymentQuote(input: { actor: BnrsActor; applicationId: string }) {
      const { application } = await loadOwnedApplication(input.actor, input.applicationId);
      const quote = scopeFromApplication(application);
      const businessAddress = await options.repository.getBusinessAddress(application.id);
      if (
        !quote ||
        !businessAddress ||
        (application.state !== "PAYMENT_READY" &&
          application.state !== "PAYMENT_PENDING" &&
          application.state !== "COMPLETED")
      )
        throw new BnrsError(
          "PAYMENT_NOT_READY",
          "Complete the business scope and business address before payment.",
        );
      return quote;
    },
    async createPayment(input: {
      actor: BnrsActor;
      applicationId: string;
      callbackUrl: string;
      redirectUrl: string;
    }) {
      const { application, egovUserId } = await loadOwnedApplication(
        input.actor,
        input.applicationId,
      );
      let started;
      if (application.state === "PAYMENT_PENDING") {
        const current = await options.repository.getCurrentPayment(application.id);
        const reusable = current ? checkoutFromPayment(current) : null;
        if (reusable) return reusable;
        if (!current)
          throw new BnrsError("PAYMENT_PROVIDER_ERROR", "The payment transaction is unavailable.");
        started = { application, payment: current };
      } else if (application.state !== "PAYMENT_READY") {
        throw new BnrsError("PAYMENT_NOT_READY", "The application is not ready for payment.");
      }
      const scope = scopeFromApplication(application);
      const businessAddress = await options.repository.getBusinessAddress(application.id);
      if (
        !scope ||
        !businessAddress ||
        !application.normalizedBusinessName ||
        !application.proposedBusinessName
      )
        throw new BnrsError(
          "PAYMENT_NOT_READY",
          "Complete the business name, scope, and business address first.",
        );

      if (!started) {
        try {
          started = await options.repository.beginPayment({
            applicationId: application.id,
            egovUserId,
            transactionId: `BNRS-PAY-${generateId()}`,
            amount: scope.totalFee,
            currency: "PHP",
            now: now(),
          });
        } catch (error) {
          if (error instanceof BnrsRepositoryConflict) {
            if (error.code === "BUSINESS_NAME_RESERVED")
              throw new BnrsError(
                "BUSINESS_NAME_UNAVAILABLE",
                "The proposed business name is no longer available.",
              );
            const current = await options.repository.getCurrentPayment(application.id);
            const reusable = current ? checkoutFromPayment(current) : null;
            if (reusable) return reusable;
            throw new BnrsError(
              "PAYMENT_PROVIDER_ERROR",
              "The payment transaction is still being created.",
            );
          }
          throw error;
        }
        if (!started) return invalidState(application.id);
      }

      try {
        const checkout = await paymentProvider().createPayment({
          transactionId: started.payment.transactionId,
          amount: started.payment.amount,
          currency: started.payment.currency,
          callbackUrl: input.callbackUrl,
          redirectUrl: input.redirectUrl,
          items: [
            {
              name: `DTI Business Name Registration — ${scope.label}`,
              amount: scope.registrationFee,
            },
            { name: "Documentary Stamp Tax", amount: scope.documentaryStampTax },
          ],
          description: {
            applicationId: application.id,
            businessName: application.proposedBusinessName,
            scope: scope.id,
          },
        });
        if (
          !checkout.transactionUuid ||
          !checkout.checkoutUrl ||
          (started.payment.transactionUuid !== null &&
            checkout.transactionUuid !== started.payment.transactionUuid) ||
          checkout.transactionId !== started.payment.transactionId ||
          checkout.amount !== started.payment.amount ||
          checkout.currency.toUpperCase() !== started.payment.currency.toUpperCase()
        )
          throw new BnrsError(
            "PAYMENT_VERIFICATION_FAILED",
            "The created provider transaction does not match the BNRS payment.",
          );
        const activated = await options.repository.activatePayment({
          paymentId: started.payment.id,
          transactionUuid: checkout.transactionUuid,
          checkoutUrl: checkout.checkoutUrl,
          providerStatus: "pending",
          expiresAt: null,
          now: now(),
        });
        if (!activated)
          throw new BnrsError(
            "PAYMENT_PROVIDER_ERROR",
            "The payment transaction could not be activated.",
          );
        return checkout;
      } catch (error) {
        if (error instanceof BnrsError) throw error;
        throw new BnrsError(
          "PAYMENT_PROVIDER_ERROR",
          "The payment transaction could not be created or recovered. Retry with the same application.",
        );
      }
    },
    async syncPaymentStatus(input: { transactionUuid: string }) {
      if (!isUuid(input.transactionUuid))
        throw new BnrsError("PAYMENT_NOT_FOUND", "The BNRS payment was not found.");
      let payment = await options.repository.getPaymentByTransactionUuid(input.transactionUuid);
      if (payment) return applyProviderSnapshot(payment, await providerSnapshot(payment));

      let snapshot: BnrsPaymentProviderSnapshot;
      try {
        snapshot = await paymentProvider().getTransaction(input.transactionUuid);
      } catch {
        throw new BnrsError("PAYMENT_NOT_FOUND", "The BNRS payment was not found.");
      }
      payment = await options.repository.getPaymentByTransactionId(snapshot.transactionId);
      if (
        !payment ||
        snapshot.transactionUuid !== input.transactionUuid ||
        payment.status !== "CREATING" ||
        payment.amount !== snapshot.amount ||
        payment.currency.toUpperCase() !== snapshot.currency.toUpperCase()
      )
        throw new BnrsError("PAYMENT_NOT_FOUND", "The BNRS payment was not found.");
      const activated = await options.repository.activatePayment({
        paymentId: payment.id,
        transactionUuid: snapshot.transactionUuid,
        checkoutUrl: null,
        providerStatus: snapshot.providerStatus,
        expiresAt: snapshot.expiresAt,
        now: now(),
      });
      if (!activated)
        throw new BnrsError(
          "PAYMENT_PROVIDER_ERROR",
          "The recovered payment transaction could not be activated.",
        );
      return applyProviderSnapshot(activated, snapshot);
    },
    async abandonApplication(input: { actor: BnrsActor; applicationId: string }) {
      const { application, egovUserId } = await loadOwnedApplication(
        input.actor,
        input.applicationId,
      );
      if (application.state === "ABANDONED") return statusFor(application);
      if (application.state === "COMPLETED") return invalidState(application.id);

      let abandonableApplication = application;
      if (application.state === "PAYMENT_PENDING") {
        const payment = await options.repository.getCurrentPayment(application.id);
        if (!payment)
          throw new BnrsError("PAYMENT_NOT_FOUND", "The pending BNRS payment was not found.");
        let snapshot = await providerSnapshot(payment);
        if (snapshot.status === "PAID")
          return (await applyProviderSnapshot(payment, snapshot)).status;
        if (snapshot.status === "PENDING") {
          try {
            await paymentProvider().voidTransaction(snapshot.transactionUuid);
          } catch {
            throw new BnrsError(
              "PAYMENT_PROVIDER_ERROR",
              "The pending payment could not be voided.",
            );
          }
          snapshot = await providerSnapshot(payment);
          if (snapshot.status === "PENDING")
            throw new BnrsError(
              "PAYMENT_PROVIDER_ERROR",
              "The provider has not confirmed that the payment is voided.",
            );
          if (snapshot.status === "PAID")
            return (await applyProviderSnapshot(payment, snapshot)).status;
        }
        const released = await applyProviderSnapshot(payment, snapshot);
        const refreshed = await options.repository.getApplication(application.id);
        if (!refreshed) return invalidState(application.id);
        abandonableApplication = refreshed;
        if (released.status.state === "COMPLETED") return released.status;
      }

      const updated = await options.repository.updateApplication({
        applicationId: abandonableApplication.id,
        egovUserId,
        expectedStates: [
          "TERMS_PENDING",
          "OWNER_INFORMATION_PENDING",
          "BUSINESS_NAME_PENDING",
          "SCOPE_PENDING",
          "PAYMENT_READY",
        ],
        patch: { state: "ABANDONED", abandonedAt: now() },
        now: now(),
      });
      return updated ? statusFor(updated) : invalidState(abandonableApplication.id);
    },
  };
}

export type BnrsService = ReturnType<typeof createBnrsService>;
