export type BnrsActor = {
  egovUserId: string;
};

export type BnrsOwnerInformationInput = {
  citizenship?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  birthDate?: string;
  gender?: string;
};

export type BnrsDescriptor = {
  id: string;
  label: string;
};

export type BnrsBusinessScopeId = "CITY_MUNICIPALITY" | "REGIONAL" | "NATIONAL";

export type BnrsBusinessScope = {
  id: BnrsBusinessScopeId;
  label: string;
  registrationFee: number;
  documentaryStampTax: number;
  totalFee: number;
};

export type BnrsApplicationState =
  | "TERMS_PENDING"
  | "OWNER_INFORMATION_PENDING"
  | "BUSINESS_NAME_PENDING"
  | "SCOPE_PENDING"
  | "PAYMENT_READY"
  | "PAYMENT_PENDING"
  | "COMPLETED"
  | "ABANDONED";

export type BnrsPaymentStatus = "CREATING" | "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "VOIDED";

export type BnrsCompletedStep =
  | "TERMS_AND_CONDITIONS"
  | "OWNER_INFORMATION"
  | "BUSINESS_NAME"
  | "BUSINESS_SCOPE"
  | "PAYMENT";

export type BnrsNextStep =
  | "TERMS_AND_CONDITIONS"
  | "OWNER_INFORMATION"
  | "BUSINESS_NAME"
  | "BUSINESS_SCOPE"
  | "PAYMENT"
  | null;

export type BnrsApplicationStatus = {
  applicationId: string;
  state: BnrsApplicationState;
  completedSteps: readonly BnrsCompletedStep[];
  nextStep: BnrsNextStep;
  termsAcceptedAt: string | null;
  ownerInformation: { stored: boolean };
  businessName: {
    dominantName: string;
    descriptorId: string;
    descriptor: string;
    proposedBusinessName: string;
  } | null;
  scope: BnrsBusinessScope | null;
  payment: {
    status: BnrsPaymentStatus;
    transactionId: string;
    amount: number;
    currency: string;
    paidAt: string | null;
  } | null;
  registration: {
    referenceCode: string;
    issuedAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type BnrsPaymentItem = {
  name: string;
  amount: number;
};

export type BnrsPaymentProviderStatus = Exclude<BnrsPaymentStatus, "CREATING">;

export type BnrsPaymentProviderSnapshot = {
  transactionUuid: string;
  transactionId: string;
  amount: number;
  currency: string;
  status: BnrsPaymentProviderStatus;
  providerStatus: string;
  paidAt: Date | null;
  expiresAt: Date | null;
};

export type BnrsPaymentCheckout = {
  transactionUuid: string;
  transactionId: string;
  checkoutUrl: string;
  status: "PENDING";
  amount: number;
  currency: string;
};

export interface BnrsPaymentProvider {
  createPayment(input: {
    transactionId: string;
    amount: number;
    currency: string;
    callbackUrl: string;
    redirectUrl: string;
    items: readonly BnrsPaymentItem[];
    description: Readonly<Record<string, unknown>>;
  }): Promise<BnrsPaymentCheckout>;
  getTransaction(transactionUuid: string): Promise<BnrsPaymentProviderSnapshot>;
  voidTransaction(transactionUuid: string): Promise<void>;
}

export type BnrsRegistrationSummary = {
  referenceCode: string;
  businessName: string;
  descriptor: string;
  scope: BnrsBusinessScopeId;
  issuedAt: string;
};

export type BnrsRegistrationResult = BnrsRegistrationSummary & {
  ownerDisplayName: string;
  totalPaid: number;
};

export type BnrsRegisteredBusiness = BnrsRegistrationSummary & {
  applicationId: string;
};

export type BnrsPaymentSyncResult = {
  status: BnrsApplicationStatus;
  registration: BnrsRegistrationResult | null;
};
