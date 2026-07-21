import type { CitizenProfile } from "@/lib/citizen-profile";

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function joinNonEmpty(parts: ReadonlyArray<unknown>, separator = " ") {
  return parts
    .map(stringValue)
    .filter((part) => part.length > 0)
    .join(separator);
}

export function mapEgovCitizenProfile(profile: unknown): CitizenProfile {
  const rawProfile = recordValue(profile);
  const fullName = joinNonEmpty([
    rawProfile.first_name,
    rawProfile.middle_name,
    rawProfile.last_name,
    rawProfile.suffix,
  ]);
  const address =
    stringValue(rawProfile.address) ||
    joinNonEmpty(
      [
        rawProfile.street,
        rawProfile.barangay,
        rawProfile.municipality,
        rawProfile.province,
        rawProfile.postal,
      ],
      ", ",
    );

  return {
    id: stringValue(rawProfile.uniqid),
    firstName: stringValue(rawProfile.first_name),
    fullName,
    email: stringValue(rawProfile.email),
    mobile: stringValue(rawProfile.mobile),
    address,
    city: stringValue(rawProfile.municipality),
    barangay: stringValue(rawProfile.barangay),
    province: stringValue(rawProfile.province),
    birthDate: stringValue(rawProfile.birth_date),
    gender: stringValue(rawProfile.gender),
    nationality: stringValue(rawProfile.nationality),
    tinMasked: "",
    rdo: "",
    avatarUrl: stringValue(rawProfile.photo) ? "/api/auth/avatar" : null,
  };
}
