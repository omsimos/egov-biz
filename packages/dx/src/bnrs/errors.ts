import type { JsonValue } from "../boundary.js";

/** Structured diagnostics attached to a domain error; always JSON-serializable. */
export type BnrsErrorDetails = Readonly<Record<string, JsonValue>>;

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
  | "INVALID_BUSINESS_ADDRESS"
  | "PAYMENT_NOT_READY"
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_PROVIDER_ERROR"
  | "PAYMENT_VERIFICATION_FAILED"
  | "CERTIFICATE_NOT_FOUND";

export class BnrsError extends Error {
  readonly code: BnrsErrorCode;
  readonly details?: BnrsErrorDetails;

  constructor(code: BnrsErrorCode, message: string, details?: BnrsErrorDetails) {
    super(message);
    this.name = "BnrsError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
