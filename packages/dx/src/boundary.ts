/**
 * The parsing boundary for payloads that reach this package as JSON: eGov SDK
 * responses, request bodies handed to the service APIs, and stored rows.
 *
 * Every runtime representation check in `@omsimos/dx` lives here, so the BNRS,
 * LGU and BIR state machines only ever branch on parsed domain values.
 */

/** A value that survives a JSON round trip unchanged. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/**
 * An object read off a JSON boundary whose fields have not been parsed yet.
 * Every field has to pass through one of the parsers below before it is used.
 */
// The value type is `unknown` precisely because nothing has parsed it yet; any
// concrete value contract here would be a claim this module cannot back.
// oxlint-disable-next-line local/no-unsafe-dictionary-type
export type UnparsedRecord = { readonly [key: string]: unknown };

export function payloadString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function payloadNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

export function payloadRecord(value: unknown): UnparsedRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  // SAFETY: the guard above accepted only a non-null, non-array object, and
  // `UnparsedRecord` asserts nothing at all about the values behind its keys.
  return value as UnparsedRecord;
}
