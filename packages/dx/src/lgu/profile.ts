import type { EgovSsoCitizenProfile } from "egov.js";

import { normalizeLguTin } from "./service.js";
import type { LguApplicantInformationInput } from "./types.js";

function normalizedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  return normalized || undefined;
}

export function mapEgovSsoProfileToLguApplicantInformation(
  profile: EgovSsoCitizenProfile,
): LguApplicantInformationInput {
  const ownerName = [profile.first_name, profile.middle_name, profile.last_name, profile.suffix]
    .map(normalizedString)
    .filter((value): value is string => value !== undefined)
    .join(" ");
  const tin = normalizeLguTin(profile.tin_id);
  return {
    ownerName,
    ...(tin === undefined ? {} : { tin }),
  };
}
