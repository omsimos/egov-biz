import {
  payloadRecord,
  payloadScalarText,
  payloadText,
  type EgovProfilePayload,
  type PayloadValue,
} from "@/lib/payload";

/** The demo TIN table: keyed by the SSO email of a seeded eGovPH test account. */
interface DummyTinDirectory {
  readonly [ssoEmail: string]: string;
}

export const DUMMY_TIN_BY_SSO_EMAIL: DummyTinDirectory = {
  "josie@yopmail.com": "000001001000", // Josie Santos Dela Cruz
  "josie01@yopmail.com": "000002002000", // Jose Cruz Dela Peña III
  "josie02@yopmail.com": "000003003000", // Arnel Dela Cruz II
  "josie03@yopmail.com": "000004004000", // John Garcia Reyes Jr.
  "josie04@yopmail.com": "000005005000", // Josielyn Ramos Mendoza
};

export const FALLBACK_DUMMY_TIN = "000999999000";

/** The field names partners use for a TIN, in the order they are preferred. */
const TIN_FIELDS = ["tin", "tin_number", "tinNumber", "id_number"];

export function normalizeTin(value: PayloadValue): string {
  const scalar = payloadScalarText(value);
  if (scalar !== null) {
    const digits = scalar.replaceAll(/\D/g, "");
    return digits.length >= 9 && digits.length <= 14 ? digits : "";
  }

  const record = payloadRecord(value);
  for (const field of TIN_FIELDS) {
    const nested = record[field];
    if (nested === undefined) continue;
    const tin = normalizeTin(nested);
    if (tin) return tin;
  }
  return "";
}

export function resolveSsoTin(profile: EgovProfilePayload): string {
  const rawProfile = payloadRecord(profile);
  const suppliedTin = normalizeTin(rawProfile.tin_id);
  if (suppliedTin) return suppliedTin;

  const email = payloadText(rawProfile.email).trim().toLowerCase();
  return DUMMY_TIN_BY_SSO_EMAIL[email] ?? FALLBACK_DUMMY_TIN;
}

export function maskTin(value: PayloadValue): string {
  const tin = normalizeTin(value);
  if (!tin) return "";
  return `${tin.slice(0, 3)}-${tin.slice(3, 6)}-***${tin.length > 9 ? `-${tin.slice(-3)}` : ""}`;
}
