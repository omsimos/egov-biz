import { describe, expect, test } from "bun:test";

import {
  BNRS_DESCRIPTORS,
  BNRS_TERMS_AND_CONDITIONS,
  getBusinessNameRequirements,
  getBusinessScopes,
} from "../src/bnrs/index.js";

describe("BNRS static catalog", () => {
  test("publishes 40 stable descriptor identifiers from the agreed subset", () => {
    expect(BNRS_DESCRIPTORS).toHaveLength(40);
    expect(new Set(BNRS_DESCRIPTORS.map(({ id }) => id)).size).toBe(40);
    expect(BNRS_DESCRIPTORS).toContainEqual({ id: "DENTAL_CLINIC", label: "DENTAL CLINIC" });
    expect(BNRS_DESCRIPTORS).toContainEqual({ id: "I_T_SOLUTIONS", label: "I.T. SOLUTIONS" });
  });

  test("returns reminders together with the descriptor catalog", () => {
    const requirements = getBusinessNameRequirements();

    expect(requirements.descriptors).toBe(BNRS_DESCRIPTORS);
    expect(requirements.reminders.length).toBeGreaterThanOrEqual(10);
  });

  test("returns the three agreed territorial scopes with DST totals", () => {
    expect(getBusinessScopes()).toEqual([
      {
        id: "CITY_MUNICIPALITY",
        label: "City/Municipality",
        registrationFee: 500,
        documentaryStampTax: 30,
        totalFee: 530,
      },
      {
        id: "REGIONAL",
        label: "Regional",
        registrationFee: 1000,
        documentaryStampTax: 30,
        totalFee: 1030,
      },
      {
        id: "NATIONAL",
        label: "National",
        registrationFee: 2000,
        documentaryStampTax: 30,
        totalFee: 2030,
      },
    ]);
  });

  test("keeps the terms concise and free of response markers", () => {
    expect(BNRS_TERMS_AND_CONDITIONS.length).toBeGreaterThan(100);
    expect(BNRS_TERMS_AND_CONDITIONS.length).toBeLessThan(2_000);
    expect(BNRS_TERMS_AND_CONDITIONS).not.toMatch(/\b(?:mock|demo)\b/i);
  });
});
