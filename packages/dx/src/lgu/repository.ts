import type {
  LguApplicationState,
  LguApplicantInformationInput,
  LguBusinessAddressInput,
  LguPaymentStatus,
  LguTerritorialScope,
} from "./types.js";

export type LguApplicationRecord = {
  id: string;
  egovUserId: string;
  state: LguApplicationState;
  city: string;
  normalizedCity: string;
  businessAddressLine1: string | null;
  businessAddressLine2: string | null;
  businessBarangay: string | null;
  businessProvince: string | null;
  businessRegion: string | null;
  businessPostalCode: string | null;
  certificateNumber: string;
  certificateIssuingAgency: "DTI-BNRS";
  certificateStatus: "REGISTERED";
  certificateBusinessName: string;
  certificateOwnerName: string;
  certificateDescriptor: string;
  certificateTerritorialScope: LguTerritorialScope;
  certificateIssuedAt: Date;
  certificateValidUntil: Date;
  latestPaymentId: string | null;
  permitNumber: string | null;
  barangayClearanceNumber: string | null;
  documentsIssuedAt: Date | null;
  documentsValidUntil: Date | null;
  abandonedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LguApplicantInformationRecord = LguApplicantInformationInput & {
  normalizedOwnerName: string;
};

export type LguApplicationPatch = Partial<
  Pick<
    LguApplicationRecord,
    | "state"
    | "latestPaymentId"
    | "permitNumber"
    | "barangayClearanceNumber"
    | "documentsIssuedAt"
    | "documentsValidUntil"
    | "abandonedAt"
  >
>;

export type LguPaymentRecord = {
  id: string;
  applicationId: string;
  provider: string;
  status: LguPaymentStatus;
  transactionId: string;
  transactionUuid: string | null;
  checkoutUrl: string | null;
  providerCallbackUrl: string;
  providerRedirectUrl: string;
  amount: number;
  currency: string;
  providerStatus: string | null;
  paidAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LguPaymentTransitionResult = {
  application: LguApplicationRecord;
  payment: LguPaymentRecord;
};

export type LguApplicationAggregate = {
  application: LguApplicationRecord;
  applicant: LguApplicantInformationRecord;
};

export type LguRepositoryConflictCode = "PAYMENT_IN_PROGRESS";

export class LguRepositoryConflict extends Error {
  readonly code: LguRepositoryConflictCode;

  constructor(code: LguRepositoryConflictCode) {
    super(code);
    this.name = "LguRepositoryConflict";
    this.code = code;
  }
}

export interface LguRepository {
  startOrResumeApplication(input: {
    egovUserId: string;
    city: string;
    normalizedCity: string;
    certificate: {
      certificateNumber: string;
      issuingAgency: "DTI-BNRS";
      status: "REGISTERED";
      businessName: string;
      ownerName: string;
      descriptor: string;
      territorialScope: LguTerritorialScope;
      businessAddress: LguBusinessAddressInput;
      issuedAt: Date;
      validUntil: Date;
    };
    applicant: LguApplicantInformationRecord;
    now: Date;
  }): Promise<LguApplicationAggregate>;
  getApplication(applicationId: string): Promise<LguApplicationRecord | null>;
  getApplicantInformation(applicationId: string): Promise<LguApplicantInformationRecord | null>;
  listCompletedApplications(egovUserId: string): Promise<LguApplicationRecord[]>;
  updateApplication(input: {
    applicationId: string;
    egovUserId: string;
    expectedStates: readonly LguApplicationState[];
    patch: LguApplicationPatch;
    now: Date;
  }): Promise<LguApplicationRecord | null>;
  getLatestPayment(applicationId: string): Promise<LguPaymentRecord | null>;
  getCurrentPayment(applicationId: string): Promise<LguPaymentRecord | null>;
  getPaymentByTransactionUuid(transactionUuid: string): Promise<LguPaymentRecord | null>;
  getPaymentByTransactionId(transactionId: string): Promise<LguPaymentRecord | null>;
  beginPayment(input: {
    applicationId: string;
    egovUserId: string;
    transactionId: string;
    amount: number;
    currency: string;
    providerCallbackUrl: string;
    providerRedirectUrl: string;
    now: Date;
  }): Promise<LguPaymentTransitionResult | null>;
  activatePayment(input: {
    paymentId: string;
    transactionUuid: string;
    checkoutUrl: string | null;
    providerStatus: string;
    expiresAt: Date | null;
    now: Date;
  }): Promise<LguPaymentRecord | null>;
  recordPendingPayment(input: {
    paymentId: string;
    providerStatus: string;
    expiresAt: Date | null;
    now: Date;
  }): Promise<LguPaymentRecord | null>;
  releasePayment(input: {
    applicationId: string;
    paymentId: string;
    status: "FAILED" | "EXPIRED" | "VOIDED";
    providerStatus: string;
    expiresAt: Date | null;
    now: Date;
  }): Promise<LguPaymentTransitionResult | null>;
  completePayment(input: {
    applicationId: string;
    paymentId: string;
    providerStatus: string;
    permitNumber: string;
    barangayClearanceNumber: string;
    paidAt: Date;
    issuedAt: Date;
    validUntil: Date;
    now: Date;
  }): Promise<LguPaymentTransitionResult | null>;
}
