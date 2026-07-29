import { describe, expect, test } from "bun:test";
import type { EgovSsoCitizenProfile } from "egov.js";

import { mapEgovSsoProfileToLguApplicantInformation } from "../src/lgu/index.js";

describe("LGU applicant profile mapping", () => {
  test("projects the owner name and full normalized TIN independently of the actor", () => {
    const profile: EgovSsoCitizenProfile = {
      uniqid: "egov-user-1",
      first_name: "  Mara ",
      middle_name: "Santos",
      last_name: "Reyes",
      suffix: "Jr.",
      tin_id: { tin_number: "123-456-789-000" },
      email: "not-forwarded@example.test",
      mobile: "+639170000000",
      barangay: "Poblacion",
    };

    expect(mapEgovSsoProfileToLguApplicantInformation(profile)).toEqual({
      ownerName: "Mara Santos Reyes Jr.",
      tin: "123456789000",
    });
  });

  test("omits an unavailable or malformed TIN", () => {
    expect(
      mapEgovSsoProfileToLguApplicantInformation({
        uniqid: "egov-user-2",
        first_name: "Mara",
        last_name: "Reyes",
        tin_id: "not-a-tin",
      }),
    ).toEqual({ ownerName: "Mara Reyes" });
  });
});
