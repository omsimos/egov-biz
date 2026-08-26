import type { EgovSsoCitizenProfile } from "egov.js";

/**
 * eGov SSO responses, sessions restored from storage, provider tool output and
 * `localStorage` records all reach this app as JSON that no schema has checked.
 * `PayloadValue` is the honest type of one decoded value out of any of them, and
 * the parsers below are the app's single boundary for such values: every other
 * module takes a `PayloadValue`/`PayloadRecord` and asks a parser here instead
 * of testing the representation itself. That is why the `typeof` checks and the
 * `unknown` inputs the rest of the app does without are suppressed here — this
 * is the boundary those rules ask for, and nothing outside it repeats them.
 */
export type PayloadValue =
  | PayloadRecord
  | boolean
  | null
  | number
  | readonly PayloadValue[]
  | string
  | undefined;

/** A decoded JSON object: the sender chose the keys, nothing has read the values. */
export interface PayloadRecord {
  readonly [key: string]: PayloadValue;
}

/**
 * How an eGov SSO citizen profile actually arrives: the SDK's own type when it
 * came straight from the client, or an unvalidated payload when it came from a
 * stored session, a fixture, or a partner response the SDK does not describe.
 * Both are read through `payloadRecord`.
 */
export type EgovProfilePayload = EgovSsoCitizenProfile | PayloadValue;

/** A record still being assembled, before it is handed on as a `PayloadRecord`. */
export interface MutablePayloadRecord {
  [key: string]: PayloadValue;
}

/**
 * Whether an unvalidated value is a JSON object rather than an array or a
 * scalar. Saying `PayloadRecord` claims its properties are themselves decoded
 * JSON values, which holds because every caller reaches this module with a
 * payload some JSON decoder produced — and nothing reads one of those
 * properties without passing it back through a parser below.
 */
export function isPayloadRecord(value: unknown): value is PayloadRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** The named fields of a decoded value, or none when it has no named fields. */
export function payloadRecord(value: unknown): PayloadRecord {
  return isPayloadRecord(value) ? value : {};
}

/** The string a decoded value holds, or `""` when it holds anything else. */
export function payloadText(value: PayloadValue): string {
  return typeof value === "string" ? value : "";
}

/** The number a decoded value holds, or `null` when it holds anything else. */
export function payloadNumber(value: PayloadValue): number | null {
  return typeof value === "number" ? value : null;
}

/**
 * The text of a decoded scalar. The same field arrives as `"000123"` from one
 * partner and as `123` from another, so both are accepted; `null` means the
 * value was neither.
 */
export function payloadScalarText(value: PayloadValue): string | null {
  const numeric = payloadNumber(value);
  if (numeric !== null) return String(numeric);
  return typeof value === "string" ? value : null;
}
