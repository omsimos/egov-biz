import type { JsonValue } from "../boundary.js";

/**
 * One rejected BIR form field, projected from the form schema's own issue list.
 * `path` keeps the schema's `PropertyKey` segments rather than stringifying them.
 */
export type BirFormIssue = {
  code: string;
  message: string;
  path: readonly PropertyKey[];
};

/** Structured diagnostics attached to a BIR error. */
export type BirErrorDetails = Readonly<Record<string, JsonValue | readonly BirFormIssue[]>>;

export type BirErrorCode =
  | "INVALID_ACTOR"
  | "INVALID_CONFIGURATION"
  | "INVALID_FORM_DATA"
  | "FORM_NOT_FOUND"
  | "INVALID_STORED_FORM";

export class BirError extends Error {
  readonly code: BirErrorCode;
  readonly details?: BirErrorDetails;

  constructor(code: BirErrorCode, message: string, details?: BirErrorDetails) {
    super(message);
    this.name = "BirError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
