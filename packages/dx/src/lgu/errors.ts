import type { JsonValue } from "../boundary.js";

/** Structured diagnostics attached to a domain error; always JSON-serializable. */
export type LguErrorDetails = Readonly<Record<string, JsonValue>>;

export type LguErrorCode =
  | "INVALID_ACTOR"
  | "INVALID_APPLICANT"
  | "INVALID_CITY"
  | "INVALID_CERTIFICATE"
  | "CERTIFICATE_OWNER_MISMATCH"
  | "APPLICATION_CONFLICT"
  | "APPLICATION_NOT_FOUND"
  | "APPLICATION_ACCESS_DENIED"
  | "INVALID_APPLICATION_STATE"
  | "ISSUED_DOCUMENTS_NOT_FOUND"
  | "PAYMENT_NOT_READY"
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_PROVIDER_ERROR"
  | "PAYMENT_VERIFICATION_FAILED";

export class LguError extends Error {
  readonly code: LguErrorCode;
  readonly details?: LguErrorDetails;

  constructor(code: LguErrorCode, message: string, details?: LguErrorDetails) {
    super(message);
    this.name = "LguError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
