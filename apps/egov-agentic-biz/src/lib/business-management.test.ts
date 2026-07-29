import { describe, expect, test } from "bun:test";
import {
  businessManagementContext,
  deterministicBusinessManagementResponse,
} from "@/lib/business-management";
import type { RegisteredBusiness } from "@/lib/registered-business";

const business: RegisteredBusiness = {
  id: "business-1",
  conversationId: "registration-1",
  name: "Kape Diaria",
  type: "Sole proprietor",
  category: "food-service",
  registrationNumber: "DX-REG-1001",
  status: "Active",
  ownerName: "Mara Reyes",
  businessActivity: "Coffee subscription boxes",
  businessAddress: "88 Ayala Avenue, Makati",
  city: "Makati",
  rdo: "RDO 047",
  tinMasked: "***-***-123",
  finalizedAt: "2026-07-20T00:00:00.000Z",
  records: [
    {
      id: "fire-safety",
      kind: "permit",
      agency: "Bureau of Fire Protection",
      title: "Fire safety inspection certificate",
      referenceNumber: "DX-BFP-1001",
      status: "Issued",
      issuedAt: "2026-07-20T00:00:00.000Z",
      validUntil: "2027-07-20T00:00:00.000Z",
      note: "Saved result for the declared premises.",
      source: "DX",
    },
  ],
  taxObligations: [
    {
      id: "income-2026-08-25",
      title: "Quarterly income tax return",
      formCode: "BIR Form 1701Q",
      frequency: "Quarterly",
      periodLabel: "Q2 2026",
      dueDate: "2026-08-25",
      status: "Upcoming",
      note: "Saved schedule.",
    },
  ],
  files: [
    {
      id: "tax-calendar",
      title: "Recurring tax filing calendar",
      filename: "DX-Tax-Calendar.pdf",
      documentType: "Tax calendar",
      status: "Available",
      createdAt: "2026-07-20T00:00:00.000Z",
      url: null,
      note: "Saved schedule.",
      source: "DX",
    },
  ],
};

describe("post-registration business chat", () => {
  test("grounds model context in one business record", () => {
    expect(businessManagementContext(business)).toMatchObject({
      business: { name: "Kape Diaria", registrationNumber: "DX-REG-1001" },
      files: [{ filename: "DX-Tax-Calendar.pdf" }],
      records: [{ referenceNumber: "DX-BFP-1001" }],
      taxCalendar: [{ formCode: "BIR Form 1701Q" }],
    });
  });

  test("answers tax-calendar questions from the saved obligations", () => {
    const answer = deterministicBusinessManagementResponse(
      business,
      "What is next on my tax calendar?",
    );
    expect(answer).toContain("Quarterly income tax return");
    expect(answer).toContain("BIR Form 1701Q");
    expect(answer).toContain("Aug 25, 2026");
    expect(answer).toContain("Confirm");
  });

  test("answers file and permit questions without starting registration", () => {
    expect(deterministicBusinessManagementResponse(business, "Which files do I have?")).toContain(
      "Recurring tax filing calendar",
    );
    const permitAnswer = deterministicBusinessManagementResponse(
      business,
      "Do I still need fire safety?",
    );
    expect(permitAnswer).toContain("Fire safety inspection certificate");
    expect(permitAnswer).toContain("Issued");
  });
});
