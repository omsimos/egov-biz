import { describe, expect, test } from "bun:test";
import type { CitizenProfile } from "@/lib/citizen-profile";
import {
  availableUserInfoFields,
  extractExplicitBusinessAddress,
  profileAddressPreference,
  resolveBusinessFormAddress,
} from "@/lib/form-prefill";

const profile: CitizenProfile = {
  id: "example-user-id",
  firstName: "Juan",
  fullName: "Juan Dela Cruz",
  email: "juan@example.test",
  mobile: "+639000000000",
  address: "1 Example Street, San Isidro, Quezon City",
  city: "Quezon City",
  barangay: "San Isidro",
  province: "Metro Manila",
  birthDate: "1990-01-01",
  gender: "Male",
  nationality: "Filipino",
  tinMasked: "",
  rdo: "",
  avatarUrl: null,
};

describe("resolveBusinessFormAddress", () => {
  test("prefills the verified profile address when the business uses it", () => {
    expect(resolveBusinessFormAddress("", profile, true)).toBe(profile.address);
  });

  test("keeps an explicit form address instead of the profile address", () => {
    expect(resolveBusinessFormAddress("  2 Market Street, Makati City  ", profile, true)).toBe(
      "2 Market Street, Makati City",
    );
  });

  test("does not copy the profile address for a different business location", () => {
    expect(resolveBusinessFormAddress("", profile, false)).toBe("");
  });

  test("uses only the dedicated structured address preference", () => {
    expect(profileAddressPreference(undefined)).toBeNull();
    expect(profileAddressPreference("use-profile-address")).toBe("profile");
    expect(profileAddressPreference("use-different-address")).toBe("different");
    expect(profileAddressPreference("Can I use my home address?")).toBeNull();
  });

  test("extracts the latest address correction directly from user text", () => {
    expect(
      extractExplicitBusinessAddress(
        "The business address is 1 First Street. Change the address to 2 Market Street, Makati City.",
      ),
    ).toBe("2 Market Street, Makati City");
  });

  test("reports only non-empty verified fields as available", () => {
    const fields = availableUserInfoFields({ ...profile, birthDate: "", mobile: "" });
    expect(fields).toContain("fullName");
    expect(fields).toContain("address");
    expect(fields).not.toContain("birthDate");
    expect(fields).not.toContain("mobile");
  });
});
