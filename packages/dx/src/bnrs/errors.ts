export type BnrsErrorCode =
  | "INVALID_ACTOR"
  | "APPLICATION_NOT_FOUND"
  | "APPLICATION_ACCESS_DENIED"
  | "INVALID_APPLICATION_STATE"
  | "INVALID_OWNER_INFORMATION"
  | "INVALID_DESCRIPTOR"
  | "INVALID_BUSINESS_NAME"
  | "BUSINESS_NAME_UNAVAILABLE"
  | "INVALID_SCOPE"
  | "PAYMENT_NOT_READY"
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_PROVIDER_ERROR"
  | "PAYMENT_VERIFICATION_FAILED"
  | "CERTIFICATE_NOT_FOUND";

export class BnrsError extends Error {
  readonly code: BnrsErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: BnrsErrorCode, message: string, details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = "BnrsError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
