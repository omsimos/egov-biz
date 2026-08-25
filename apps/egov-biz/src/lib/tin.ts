export const DUMMY_TIN_BY_SSO_EMAIL: Readonly<Record<string, string>> = {
  "josie@yopmail.com": "000001001000", // Josie Santos Dela Cruz
  "josie01@yopmail.com": "000002002000", // Jose Cruz Dela Peña III
  "josie02@yopmail.com": "000003003000", // Arnel Dela Cruz II
  "josie03@yopmail.com": "000004004000", // John Garcia Reyes Jr.
  "josie04@yopmail.com": "000005005000", // Josielyn Ramos Mendoza
};

export const FALLBACK_DUMMY_TIN = "000999999000";

export function normalizeTin(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    const digits = String(value).replaceAll(/\D/g, "");
    return digits.length >= 9 && digits.length <= 14 ? digits : "";
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";

  const record = value as Record<string, unknown>;
  for (const key of ["tin", "tin_number", "tinNumber", "id_number"]) {
    const tin = normalizeTin(record[key]);
    if (tin) return tin;
  }
  return "";
}

export function resolveSsoTin(profile: unknown): string {
  const rawProfile =
    profile && typeof profile === "object" && !Array.isArray(profile)
      ? (profile as Record<string, unknown>)
      : {};
  const suppliedTin = normalizeTin(rawProfile.tin_id);
  if (suppliedTin) return suppliedTin;

  const email = typeof rawProfile.email === "string" ? rawProfile.email.trim().toLowerCase() : "";
  return DUMMY_TIN_BY_SSO_EMAIL[email] ?? FALLBACK_DUMMY_TIN;
}

export function maskTin(value: unknown): string {
  const tin = normalizeTin(value);
  if (!tin) return "";
  return `${tin.slice(0, 3)}-${tin.slice(3, 6)}-***${tin.length > 9 ? `-${tin.slice(-3)}` : ""}`;
}
