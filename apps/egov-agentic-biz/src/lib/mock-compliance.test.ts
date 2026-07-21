import { describe, expect, test } from "bun:test";
import type { EbplsBusinessPermitReceipt } from "@/lib/business-chat";
import { buildMockCompliance, buildTaxObligations } from "@/lib/mock-compliance";
import type { BusinessPlan } from "@/lib/questions";

const receipt: EbplsBusinessPermitReceipt = {
  system: "EBPLS",
  permitType: "New business permit",
  businessName: "Mabini Kitchen",
  ownerName: "Juan Dela Cruz",
  businessActivity: "Prepared food",
  businessAddress: "123 Mabini Street, Quezon City",
  barangay: "San Isidro",
  city: "Quezon City",
  barangayClearanceReference: "BCLR-1",
  registrationDocument: "DTI certificate",
  attachments: [],
  status: "Permit issued",
  referenceNumber: "EBPLS-1",
  submittedAt: "2026-07-01T00:00:00.000Z",
  issuedAt: "2026-07-22T00:00:00.000Z",
  validUntil: "2026-12-31T23:59:59.000Z",
  feeLabel: "PHP 2,500",
  nextAction: "Continue",
};

function plan(flags: BusinessPlan["flags"], people = 1): BusinessPlan {
  return {
    businessLabel: "Food business",
    registrationType: "Sole proprietor",
    city: "Quezon City",
    setup: [],
    people,
    category: "food-service",
    flags,
    rdo: null,
    rationale: [],
    citations: [],
  };
}

describe("buildMockCompliance", () => {
  test("creates sanitary, fire, and employer mock records when applicable", () => {
    const result = buildMockCompliance(
      plan(["food", "physical-premises", "employees"], 3),
      receipt,
      new Date("2026-07-22T00:00:00.000Z"),
    );

    expect(result.records.find(({ id }) => id === "sanitary-permit")?.status).toBe("Issued");
    expect(result.records.find(({ id }) => id === "fire-safety")?.status).toBe("Issued");
    expect(result.records.find(({ id }) => id === "sss-employer")?.status).toBe("Active");
    expect(result.taxObligations.length).toBe(4);
  });

  test("records non-applicable sector and employer requirements without claiming approval", () => {
    const result = buildMockCompliance(plan([], 1), receipt, new Date("2026-07-22T00:00:00.000Z"));

    expect(result.records.find(({ id }) => id === "sector-permits")?.status).toBe("Not required");
    expect(result.records.find(({ id }) => id === "sss-employer")?.status).toBe("Not required");
    expect(result.records.every(({ demo }) => demo)).toBe(true);
  });
});

describe("buildTaxObligations", () => {
  test("sorts future mock obligations by due date", () => {
    const obligations = buildTaxObligations(new Date("2026-07-22T00:00:00.000Z"));

    expect(obligations.map(({ dueDate }) => dueDate)).toEqual(
      [...obligations].map(({ dueDate }) => dueDate).sort(),
    );
    expect(obligations.every(({ note }) => /mock|review/i.test(note))).toBe(true);
  });
});
