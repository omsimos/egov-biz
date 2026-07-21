import { describe, expect, test } from "bun:test";
import type { EbplsBusinessPermitReceipt } from "@/lib/business-chat";
import {
  buildFinalSelfEmployedBusiness,
  buildMockCompliance,
  buildSelfEmployedMockCompliance,
  buildTaxObligations,
} from "@/lib/mock-compliance";
import type { CitizenProfile } from "@/lib/citizen-profile";
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

describe("self-employed demo completion", () => {
  test("finalizes BIR and tax setup without inventing DTI or local permits", () => {
    const professionalPlan: BusinessPlan = {
      ...plan([], 1),
      businessLabel: "Virtual assistant services",
      registrationType: "Self-employed",
      category: "professional-services",
    };
    const profile = {
      id: "citizen-1",
      fullName: "Juan Dela Cruz",
      tinMasked: "***-***-123",
      rdo: "RDO 54B",
    } as CitizenProfile;
    const compliance = buildSelfEmployedMockCompliance(
      professionalPlan,
      profile.fullName,
      new Date("2026-07-22T00:00:00.000Z"),
    );
    const business = buildFinalSelfEmployedBusiness({
      conversationId: "conversation-1",
      profile,
      plan: professionalPlan,
      businessAddress: "123 Mabini Street, General Trias",
      compliance,
      files: [],
    });

    expect(business.records.map(({ id }) => id)).toEqual(
      expect.arrayContaining(["bir-registration", "books-of-accounts", "invoice-setup"]),
    );
    expect(business.records.some(({ agency }) => /DTI|EBPLS/i.test(agency))).toBe(false);
    expect(business.records.some(({ id }) => id === "barangay-clearance")).toBe(false);
    expect(business.taxObligations.length).toBeGreaterThan(0);
  });
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
