export type LguActor = {
  egovUserId: string;
};

export type LguApplicantInformationInput = {
  ownerName: string;
  tin?: string;
};

export type LguTerritorialScope = "CITY_MUNICIPALITY" | "REGIONAL" | "NATIONAL";

export type LguBusinessAddressInput = {
  addressLine1: string;
  addressLine2?: string;
  barangay: string;
  cityMunicipality: string;
  province: string;
  region: string;
  postalCode: string;
};

export type LguBusinessRegistrationCredentialInput = {
  certificateNumber: string;
  issuingAgency: "DTI-BNRS";
  businessName: string;
  ownerName: string;
  descriptor: string;
  territorialScope: LguTerritorialScope;
  businessAddress: LguBusinessAddressInput;
  issuedAt: string;
  validUntil: string;
  status: "REGISTERED";
};

export type LguApplicationState = "PAYMENT_READY" | "PAYMENT_PENDING" | "COMPLETED" | "ABANDONED";

export type LguPaymentStatus = "CREATING" | "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "VOIDED";

export type LguPaymentQuote = {
  businessPermitFee: number;
  totalFee: number;
  currency: "PHP";
};

export type LguPaymentItem = {
  name: string;
  amount: number;
};

export type LguPaymentProviderStatus = Exclude<LguPaymentStatus, "CREATING">;

export type LguPaymentProviderSnapshot = {
  transactionUuid: string;
  transactionId: string;
  amount: number;
  currency: string;
  status: LguPaymentProviderStatus;
  providerStatus: string;
  paidAt: Date | null;
  expiresAt: Date | null;
};

export type LguPaymentCheckout = {
  transactionUuid: string;
  transactionId: string;
  checkoutUrl: string;
  status: "PENDING";
  amount: number;
  currency: string;
};

export interface LguPaymentProvider {
  createPayment(input: {
    transactionId: string;
    amount: number;
    currency: string;
    callbackUrl: string;
    redirectUrl: string;
    items: readonly LguPaymentItem[];
    description: Readonly<Record<string, unknown>>;
  }): Promise<LguPaymentCheckout>;
  getTransaction(transactionUuid: string): Promise<LguPaymentProviderSnapshot>;
  voidTransaction(transactionUuid: string): Promise<void>;
}

export type LguBusinessPermit = {
  permitNumber: string;
  issuingLgu: string;
  permitType: "NEW_BUSINESS";
  bnrsCertificateNumber: string;
  businessName: string;
  ownerName: string;
  tin?: string;
  businessActivity: string;
  businessAddress: LguBusinessAddressInput;
  territorialScope: LguTerritorialScope;
  issuedAt: string;
  validUntil: string;
  status: "ACTIVE";
  totalPaid: number;
};

export type LguBarangayClearance = {
  clearanceNumber: string;
  issuingLgu: string;
  clearanceType: "BARANGAY_BUSINESS_CLEARANCE";
  bnrsCertificateNumber: string;
  businessName: string;
  ownerName: string;
  tin?: string;
  businessActivity: string;
  businessAddress: LguBusinessAddressInput;
  issuedAt: string;
  validUntil: string;
  status: "APPROVED";
  includedInBusinessPermitFee: true;
};

export type LguIssuedDocuments = {
  applicationId: string;
  businessPermit: LguBusinessPermit;
  barangayClearance: LguBarangayClearance;
};

export type LguPaymentSummary = {
  status: LguPaymentStatus;
  transactionId: string;
  amount: number;
  currency: string;
  paidAt: string | null;
};

export type LguApplicationStatus = {
  applicationId: string;
  state: LguApplicationState;
  city: string;
  applicant: LguApplicantInformationInput;
  certificate: LguBusinessRegistrationCredentialInput;
  fee: LguPaymentQuote;
  payment: LguPaymentSummary | null;
  issuedDocuments: LguIssuedDocuments | null;
  createdAt: string;
  updatedAt: string;
};

export type LguPaymentSyncResult = {
  status: {
    applicationId: string;
    state: LguApplicationState;
    payment: LguPaymentSummary | null;
    documentsIssued: boolean;
  };
};
