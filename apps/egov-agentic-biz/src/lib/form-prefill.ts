import type { CitizenProfile } from "@/lib/citizen-profile";
import type { BusinessAddressSource, UserInfoOutput } from "@/lib/business-chat";

export type BusinessAddressPreference = "profile" | "different" | null;

export type ConfirmedBusinessAddress = {
  address: string;
  source: BusinessAddressSource;
};

export function resolveConfirmedBusinessAddress(
  providedAddress: string,
  profile: CitizenProfile | null,
  preference: BusinessAddressPreference,
): ConfirmedBusinessAddress | null {
  const provided = providedAddress.trim();
  if (provided) return { address: provided, source: "user-provided" };

  const registeredResidentialAddress = profile?.address.trim() ?? "";
  if (preference !== "profile" || !registeredResidentialAddress) return null;

  return {
    address: registeredResidentialAddress,
    source: "egov-residential",
  };
}

export function profileAddressPreference(value: string | string[] | undefined) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  if (selected.includes("use-profile-address")) return "profile" as const;
  if (selected.includes("use-different-address")) return "different" as const;
  return null;
}

export function extractExplicitBusinessAddress(prompt: string) {
  const matches = [
    ...prompt.matchAll(
      /\b(?:(?:(?:business|operating|store|office) address)(?:\s+(?:is|to)|\s*[:=])|(?:change|update|correct|set|use)(?:\s+the)?\s+(?:business\s+)?address\s+to)\s*[“"]?([^”"\n]{5,180}?)(?=(?:[.!?]\s+(?:change|update|correct|set|use|my|the)\b)|$)/gi,
    ),
  ];
  return matches.at(-1)?.[1]?.trim().replace(/[.]+$/, "") ?? "";
}

export function availableUserInfoFields(profile: CitizenProfile) {
  const candidates: Array<[UserInfoOutput["availableFields"][number], string]> = [
    ["fullName", profile.fullName],
    ["birthDate", profile.birthDate],
    ["gender", profile.gender],
    ["nationality", profile.nationality],
    ["email", profile.email],
    ["mobile", profile.mobile],
    ["address", profile.address],
    ["barangay", profile.barangay],
    ["municipality", profile.city],
    ["province", profile.province],
  ];
  return candidates.filter(([, value]) => value.trim().length > 0).map(([field]) => field);
}
