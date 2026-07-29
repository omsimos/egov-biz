import type {
  BnrsApplicationState,
  BnrsBusinessScopeId,
  BnrsOwnerInformationInput,
  BnrsPaymentStatus,
} from "./types.js";

export type BnrsApplicationRecord = {
  id: string;
  egovUserId: string;
  state: BnrsApplicationState;
  termsAcceptedAt: Date | null;
  dominantName: string | null;
  descriptorId: string | null;
  descriptorLabel: string | null;
  proposedBusinessName: string | null;
  normalizedBusinessName: string | null;
  scope: BnrsBusinessScopeId | null;
  registrationFee: number | null;
  documentaryStampTax: number | null;
  totalFee: number | null;
  latestPaymentId: string | null;
  referenceCode: string | null;
  issuedAt: Date | null;
  abandonedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BnrsApplicationPatch = Partial<
  Pick<
    BnrsApplicationRecord,
    | "state"
    | "termsAcceptedAt"
    | "dominantName"
    | "descriptorId"
    | "descriptorLabel"
    | "proposedBusinessName"
    | "normalizedBusinessName"
    | "scope"
    | "registrationFee"
    | "documentaryStampTax"
    | "totalFee"
    | "latestPaymentId"
    | "referenceCode"
    | "issuedAt"
    | "abandonedAt"
  >
>;

export type BnrsPaymentRecord = {
  id: string;
  applicationId: string;
  provider: string;
  status: BnrsPaymentStatus;
  transactionId: string;
  transactionUuid: string | null;
  checkoutUrl: string | null;
  amount: number;
  currency: string;
  providerStatus: string | null;
  paidAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BnrsPaymentTransitionResult = {
  application: BnrsApplicationRecord;
  payment: BnrsPaymentRecord;
};

export type BnrsRepositoryConflictCode = "BUSINESS_NAME_RESERVED" | "PAYMENT_IN_PROGRESS";

export class BnrsRepositoryConflict extends Error {
  readonly code: BnrsRepositoryConflictCode;

  constructor(code: BnrsRepositoryConflictCode) {
    super(code);
    this.name = "BnrsRepositoryConflict";
    this.code = code;
  }
}

export interface BnrsRepository {
  startOrResumeApplication(egovUserId: string, now: Date): Promise<BnrsApplicationRecord>;
  getApplication(applicationId: string): Promise<BnrsApplicationRecord | null>;
  listCompletedApplications(egovUserId: string): Promise<BnrsApplicationRecord[]>;
  hasOwnerInformation(applicationId: string): Promise<boolean>;
  getOwnerInformation(applicationId: string): Promise<BnrsOwnerInformationInput | null>;
  updateApplication(input: {
    applicationId: string;
    egovUserId: string;
    expectedStates: readonly BnrsApplicationState[];
    patch: BnrsApplicationPatch;
    now: Date;
  }): Promise<BnrsApplicationRecord | null>;
  saveOwnerInformationAndAdvance(input: {
    applicationId: string;
    egovUserId: string;
    expectedState: "OWNER_INFORMATION_PENDING";
    owner: BnrsOwnerInformationInput;
    now: Date;
  }): Promise<BnrsApplicationRecord | null>;
  isBusinessNameReserved(input: {
    normalizedBusinessName: string;
    excludeApplicationId: string;
  }): Promise<boolean>;
  getLatestPayment(applicationId: string): Promise<BnrsPaymentRecord | null>;
  getCurrentPayment(applicationId: string): Promise<BnrsPaymentRecord | null>;
  getPaymentByTransactionUuid(transactionUuid: string): Promise<BnrsPaymentRecord | null>;
  getPaymentByTransactionId(transactionId: string): Promise<BnrsPaymentRecord | null>;
  beginPayment(input: {
    applicationId: string;
    egovUserId: string;
    transactionId: string;
    amount: number;
    currency: string;
    now: Date;
  }): Promise<BnrsPaymentTransitionResult | null>;
  activatePayment(input: {
    paymentId: string;
    transactionUuid: string;
    checkoutUrl: string | null;
    providerStatus: string;
    expiresAt: Date | null;
    now: Date;
  }): Promise<BnrsPaymentRecord | null>;
  failPaymentCreation(input: {
    applicationId: string;
    paymentId: string;
    providerStatus: string;
    now: Date;
  }): Promise<BnrsPaymentTransitionResult | null>;
  recordPendingPayment(input: {
    paymentId: string;
    providerStatus: string;
    expiresAt: Date | null;
    now: Date;
  }): Promise<BnrsPaymentRecord | null>;
  releasePayment(input: {
    applicationId: string;
    paymentId: string;
    status: "FAILED" | "EXPIRED" | "VOIDED";
    providerStatus: string;
    expiresAt: Date | null;
    now: Date;
  }): Promise<BnrsPaymentTransitionResult | null>;
  completePayment(input: {
    applicationId: string;
    paymentId: string;
    providerStatus: string;
    referenceCode: string;
    paidAt: Date;
    issuedAt: Date;
    now: Date;
  }): Promise<BnrsPaymentTransitionResult | null>;
}
