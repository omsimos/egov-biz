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

export function maskTin(value: unknown): string {
  const tin = normalizeTin(value);
  if (!tin) return "";
  return `${tin.slice(0, 3)}-${tin.slice(3, 6)}-***${tin.length > 9 ? `-${tin.slice(-3)}` : ""}`;
}
