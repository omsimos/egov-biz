import type { CitizenProfile } from "@/lib/citizen-profile";
import { payloadRecord, payloadText } from "@/lib/payload";

// Remembers the last signed-in account (like the real eGovPH app) so the
// login screen can greet the citizen by name with their masked mobile number.
// Only non-sensitive display values are stored.
const STORAGE_KEY = "egov.last-account";

export type LastAccount = {
  firstName: string;
  maskedMobile: string;
};

export function maskMobile(mobile: string): string {
  const compact = mobile.replace(/[^\d+]/g, "");
  if (compact.length < 10) return "";
  return `${compact.slice(0, 6)}***${compact.slice(-4)}`;
}

export function writeLastAccount(record: LastAccount) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage may be unavailable (private mode); the login screen degrades gracefully.
  }
}

export function rememberAccount(profile: CitizenProfile) {
  writeLastAccount({
    firstName: profile.firstName,
    maskedMobile: maskMobile(profile.mobile),
  });
}

// Backs "Switch Account" on the login screen. That control used to link to the
// eGov API catalog, which switched nothing; forgetting the remembered account
// is the whole of what it should do, since nothing else about it is persisted.
export function clearLastAccount() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable (private mode); the login screen degrades gracefully.
  }
}

export function readLastAccount(): LastAccount | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = payloadRecord(JSON.parse(raw));
    const firstName = payloadText(parsed.firstName);
    if (!firstName) return null;
    return { firstName, maskedMobile: payloadText(parsed.maskedMobile) };
  } catch {
    return null;
  }
}
