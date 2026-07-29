import { describe, expect, test } from "bun:test";
import { isCompleteBusinessAddress } from "@/lib/business-address";
import type { CitizenProfile } from "@/lib/citizen-profile";
import {
  availableUserInfoFields,
  extractExplicitBusinessAddress,
  profileAddressPreference,
  resolveConfirmedBusinessAddress,
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

describe("business address prefill", () => {
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

  test("does not treat a residential-address statement as a confirmed business address", () => {
    expect(
      extractExplicitBusinessAddress(
        "My residential address is 1 Example Street, Barangay San Isidro, Quezon City.",
      ),
    ).toBe("");
  });

  test("reports only non-empty verified fields as available", () => {
    const fields = availableUserInfoFields({ ...profile, birthDate: "", mobile: "" });
    expect(fields).toContain("fullName");
    expect(fields).toContain("address");
    expect(fields).not.toContain("birthDate");
    expect(fields).not.toContain("mobile");
  });
});

describe("isCompleteBusinessAddress", () => {
  test("requires premises, barangay, and comma-separated address components", () => {
    expect(
      isCompleteBusinessAddress("Unit 2, 88 Ayala Avenue, Barangay San Lorenzo, Makati City"),
    ).toBe(true);
    expect(isCompleteBusinessAddress("Unit 2 Main Building")).toBe(false);
    expect(isCompleteBusinessAddress("Makati City")).toBe(false);
  });
});

describe("resolveConfirmedBusinessAddress", () => {
  test("requires an explicit choice before using the SSO residential address", () => {
    expect(resolveConfirmedBusinessAddress("", profile, null)).toBeNull();
  });

  test("records consent when the residential address is used for the business", () => {
    expect(resolveConfirmedBusinessAddress("", profile, "profile")).toEqual({
      address: profile.address,
      source: "egov-residential",
    });
  });

  test("records a separately supplied business address", () => {
    expect(
      resolveConfirmedBusinessAddress(
        "  2 Market Street, Barangay Poblacion, Makati City  ",
        profile,
        null,
      ),
    ).toEqual({
      address: "2 Market Street, Barangay Poblacion, Makati City",
      source: "user-provided",
    });
  });

  test("does not confirm the different-address route until an address is supplied", () => {
    expect(resolveConfirmedBusinessAddress("", profile, "different")).toBeNull();
  });

  test("does not confirm an empty SSO residential address", () => {
    expect(resolveConfirmedBusinessAddress("", { ...profile, address: "" }, "profile")).toBeNull();
  });
});
