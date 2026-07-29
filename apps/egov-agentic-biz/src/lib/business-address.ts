import { isPlaceholderAnswer } from "@/lib/intake-validation";

export function isCompleteBusinessAddress(value: string) {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length < 10 || isPlaceholderAnswer(text)) return false;

  const hasPremises =
    /\b(?:\d{1,5}|unit|room|floor|block|lot|house|street|st\.?|road|rd\.?|avenue|ave\.?|drive|highway|building|bldg\.?|plaza|village|subdivision)\b/i.test(
      text,
    );
  const hasNamedBarangay = /\b(?:barangay|brgy\.?|purok|sitio|poblacion)\b/i.test(text);
  const components = text
    .split(",")
    .map((component) => component.trim())
    .filter(Boolean);

  return hasPremises && components.length >= 2 && (hasNamedBarangay || components.length >= 3);
}
