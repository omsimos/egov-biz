export type BirErrorCode =
  | "INVALID_ACTOR"
  | "INVALID_CONFIGURATION"
  | "INVALID_FORM_DATA"
  | "FORM_NOT_FOUND"
  | "INVALID_STORED_FORM";

export class BirError extends Error {
  readonly code: BirErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: BirErrorCode, message: string, details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = "BirError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
