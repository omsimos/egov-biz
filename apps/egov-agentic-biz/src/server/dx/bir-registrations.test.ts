import { describe, expect, test } from "bun:test";
import {
  birRegistrationReference,
  createBirSelfEmployedBusinessRecord,
  createBirSoleProprietorBusinessRecord,
  type FinalizeBirSelfEmployedRegistrationInput,
} from "@/server/dx/bir-registrations";
import { buildBir2303Input } from "@/lib/form-generators/bir-2303";
import type { RegisteredBusiness } from "@/lib/registered-business";

const input: FinalizeBirSelfEmployedRegistrationInput = {
  businessActivity: "Professional services",
  businessAddress: "123 Rizal Street, Makati City",
  category: "professional-services",
  city: "Makati City",
  conversationId: "d9559dc1-31db-42b6-89c1-ac8601a478fc",
  finalizedAt: "2026-07-30T01:30:00.000Z",
  name: "JOSIE SANTOS DELA CRUZ",
  ownerEgovUserId: "egov-user-1",
  rdo: "047 - RDO Makati",
  tinMasked: "••••••7890",
};

describe("BIR self-employed business records", () => {
  test("projects a completed Form 1901 registration into an active BIR record", () => {
    const artifactId = "12345678-1234-4123-8123-123456789abc";
    const business = createBirSelfEmployedBusinessRecord(input, [
      {
        artifactId,
        createdAt: "2026-07-30T01:20:00.000Z",
        formType: "1901",
      },
    ]);

    expect(business).toMatchObject({
      id: `bir-${input.conversationId}`,
      conversationId: input.conversationId,
      name: input.name,
      type: "Self-employed",
      registrationNumber: birRegistrationReference(artifactId),
      status: "Active",
    });
    expect(business.records[0]).toMatchObject({
      agency: "Bureau of Internal Revenue",
      title: "Self-Employed Taxpayer Registration",
      status: "Active",
    });
    expect(business.files[0]).toMatchObject({
      id: artifactId,
      title: "BIR Form 1901",
      status: "Generated",
    });
    expect(business.files[1]).toMatchObject({
      id: "bir-form-2303",
      title: "BIR Certificate of Registration (Form 2303)",
      status: "Available",
      source: "DX",
    });
    expect(business.taxObligations).toHaveLength(4);
    expect(business.taxObligations[0]).toMatchObject({
      businessType: "Self-employed",
      dueDate: "2026-08-15",
      formCode: "BIR Form 1701Q",
      simulated: true,
    });
  });

  test("refuses to finalize without the authoritative Form 1901 artifact", () => {
    expect(() => createBirSelfEmployedBusinessRecord(input, [])).toThrow(
      "BIR Form 1901 was not found",
    );
  });
});

describe("BIR sole-proprietor business records", () => {
  test("adds a sole-proprietor calendar at the completion checkpoint", () => {
    const existing: RegisteredBusiness = {
      id: "bnrs-application-1",
      conversationId: "conversation-1",
      name: "Mabini Market",
      type: "Sole proprietor",
      category: "retail",
      registrationNumber: "BNN-20260730-ABC12345",
      status: "Active",
      ownerName: "JOSIE SANTOS DELA CRUZ",
      businessActivity: "Online retail",
      businessAddress: "123 Rizal Street, Makati City",
      city: "Makati City",
      rdo: "047 - RDO Makati",
      tinMasked: "••••••7890",
      finalizedAt: "2026-07-30T01:20:00.000Z",
      records: [],
      taxObligations: [],
      files: [],
    };

    const business = createBirSoleProprietorBusinessRecord(
      {
        business: existing,
        finalizedAt: "2026-07-30T02:00:00.000Z",
      },
      [
        {
          artifactId: "87654321-4321-4123-8123-cba987654321",
          createdAt: "2026-07-30T01:50:00.000Z",
          formType: "1901",
        },
      ],
    );

    expect(business.finalizedAt).toBe("2026-07-30T02:00:00.000Z");
    expect(business.records.at(-1)).toMatchObject({
      agency: "Bureau of Internal Revenue",
      referenceNumber: birRegistrationReference("87654321-4321-4123-8123-cba987654321"),
      status: "Active",
      title: "Taxpayer Registration",
    });
    expect(business.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "bir-form-2303",
          title: "BIR Certificate of Registration (Form 2303)",
          status: "Available",
        }),
      ]),
    );
    expect(buildBir2303Input(business).ocn).toBe(
      birRegistrationReference("87654321-4321-4123-8123-cba987654321"),
    );
    expect(business.taxObligations).toHaveLength(4);
    expect(business.taxObligations[0]).toMatchObject({
      businessType: "Sole proprietor",
      dueDate: "2026-08-15",
      formCode: "BIR Form 1701Q",
      simulated: true,
    });
  });
});
