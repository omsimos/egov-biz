import { describe, expect, test } from "bun:test";
import type { EgovSsoCitizenProfile } from "@repo/egov/eGovSso";

import { mapEgovSsoProfileToBnrsOwnerInformation } from "../src/bnrs/index.js";

describe("BNRS owner profile mapping", () => {
  test("projects only the agreed owner fields", () => {
    const profile: EgovSsoCitizenProfile = {
      uniqid: "egov-user-1",
      nationality: "Filipino",
      first_name: "  Genrev ",
      middle_name: "Eledia",
      last_name: "Zapa",
      suffix: "Jr.",
      birth_date: "1996-11-30",
      gender: "Male",
      email: "not-stored@example.test",
      mobile: "+639170000000",
      additional_information: {
        other_personal_information: { marital_status: "Single" },
      },
    };

    expect(mapEgovSsoProfileToBnrsOwnerInformation(profile)).toEqual({
      citizenship: "Filipino",
      firstName: "Genrev",
      middleName: "Eledia",
      lastName: "Zapa",
      suffix: "Jr.",
      birthDate: "1996-11-30",
      gender: "Male",
    });
  });

  test("silently omits unavailable values", () => {
    expect(mapEgovSsoProfileToBnrsOwnerInformation({ uniqid: "egov-user-2" })).toEqual({});
  });

  test("normalizes Philippine country values to Filipino citizenship", () => {
    expect(
      mapEgovSsoProfileToBnrsOwnerInformation({
        uniqid: "egov-user-3",
        country_alpha_3_code: "PHL",
      }),
    ).toEqual({ citizenship: "Filipino" });
  });
});
