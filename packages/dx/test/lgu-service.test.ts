import { describe, expect, test } from "bun:test";

import {
  LGU_BUSINESS_PERMIT_FEE,
  LguError,
  createLguService,
  type LguBusinessRegistrationCredentialInput,
} from "../src/lgu/index.js";
import { MemoryLguRepository } from "./support/memory-lgu-repository.js";

const NOW = new Date("2026-07-29T08:30:00.000Z");

const certificate: LguBusinessRegistrationCredentialInput = {
  certificateNumber: "BN-2026-00001234",
  issuingAgency: "DTI-BNRS",
  businessName: "Molar Bear Dental Clinic",
  ownerName: "Mara Reyes",
  descriptor: "Dental Clinic",
  territorialScope: "CITY_MUNICIPALITY",
  issuedAt: "2026-07-28T08:30:00.000Z",
  validUntil: "2031-07-28T08:30:00.000Z",
  status: "REGISTERED",
  businessAddress: {
    addressLine1: "12 Acacia Street",
    addressLine2: "Unit 4",
    barangay: "Poblacion",
    cityMunicipality: "Makati City",
    province: "Metro Manila",
    region: "National Capital Region",
    postalCode: "1210",
  },
};

function setup() {
  const repository = new MemoryLguRepository();
  const service = createLguService({ repository, now: () => NOW });
  const actor = { egovUserId: "egov-user-1" };
  const applicant = { ownerName: "Mara Reyes", tin: "123-456-789-000" };
  return { actor, applicant, repository, service };
}

async function expectLguError<T>(action: () => Promise<T>, code: LguError["code"]) {
  try {
    await action();
    throw new Error("Expected an LguError");
  } catch (error) {
    expect(error).toBeInstanceOf(LguError);
    // SAFETY: the expectation above throws unless `error` is a LguError, so this
    // line is only reached once that instance check has held.
    expect((error as LguError).code).toBe(code);
  }
}

describe("LGU application workflow", () => {
  test("starts payment-ready from the certificate's structured business address", async () => {
    const { actor, applicant, repository, service } = setup();

    const status = await service.startOrResumeApplication({
      actor,
      applicant,
      certificate,
    });

    expect(status).toMatchObject({
      state: "PAYMENT_READY",
      city: "Makati City",
      applicant: { ownerName: "Mara Reyes", tin: "123456789000" },
      certificate: {
        certificateNumber: "BN-2026-00001234",
        businessName: "Molar Bear Dental Clinic",
        businessAddress: certificate.businessAddress,
      },
      payment: null,
      issuedDocuments: null,
    });
    expect(await service.getPaymentQuote({ actor, applicationId: status.applicationId })).toEqual({
      businessPermitFee: LGU_BUSINESS_PERMIT_FEE,
      totalFee: 2_500,
      currency: "PHP",
    });
    expect(repository.applications.get(status.applicationId)?.normalizedCity).toBe("MAKATI CITY");
  });

  test("resumes matching data and rejects conflicting immutable snapshots", async () => {
    const { actor, applicant, service } = setup();
    const first = await service.startOrResumeApplication({
      actor,
      applicant,
      certificate,
    });
    const resumed = await service.startOrResumeApplication({
      actor,
      applicant,
      certificate,
    });

    expect(resumed.applicationId).toBe(first.applicationId);
    await expectLguError(
      () =>
        service.startOrResumeApplication({
          actor,
          applicant,
          certificate: { ...certificate, businessName: "Changed Business" },
        }),
      "APPLICATION_CONFLICT",
    );
    await expectLguError(
      () =>
        service.startOrResumeApplication({
          actor,
          applicant,
          certificate: {
            ...certificate,
            businessAddress: { ...certificate.businessAddress, addressLine1: "88 Narra Avenue" },
          },
        }),
      "APPLICATION_CONFLICT",
    );
  });

  test("allows the same certificate in another city", async () => {
    const { actor, applicant, service } = setup();
    const makati = await service.startOrResumeApplication({
      actor,
      applicant,
      certificate,
    });
    const pasig = await service.startOrResumeApplication({
      actor,
      applicant,
      certificate: {
        ...certificate,
        businessAddress: {
          ...certificate.businessAddress,
          barangay: "San Antonio",
          cityMunicipality: "Pasig City",
          postalCode: "1605",
        },
      },
    });

    expect(pasig.applicationId).not.toBe(makati.applicationId);
  });

  test("validates the independent certificate contract and owner agreement", async () => {
    const { actor, applicant, service } = setup();

    await expectLguError(
      () =>
        service.startOrResumeApplication({
          actor,
          applicant,
          // SAFETY: the assertion only builds the invalid input. `issuingAgency`
          // is re-checked at runtime, and this case exists to prove a non-BNRS
          // agency is rejected with INVALID_CERTIFICATE.
          certificate: { ...certificate, issuingAgency: "OTHER" as "DTI-BNRS" },
        }),
      "INVALID_CERTIFICATE",
    );
    await expectLguError(
      () =>
        service.startOrResumeApplication({
          actor,
          applicant,
          certificate: {
            ...certificate,
            // SAFETY: the assertion only builds the invalid input; the claim under
            // test is that the service rejects it with INVALID_CERTIFICATE.
            // A certificate reaches the service as JSON, so a missing business
            // address is reachable at runtime but has no compile-time spelling —
            // only a chain through `unknown` can construct that payload here.
            // oxlint-disable-next-line local/no-chained-type-assertions
            businessAddress: undefined as unknown as typeof certificate.businessAddress,
          },
        }),
      "INVALID_CERTIFICATE",
    );
    await expectLguError(
      () =>
        service.startOrResumeApplication({
          actor,
          applicant,
          certificate: { ...certificate, validUntil: "2026-07-01T00:00:00.000Z" },
        }),
      "INVALID_CERTIFICATE",
    );
    await expectLguError(
      () =>
        service.startOrResumeApplication({
          actor,
          applicant,
          certificate: { ...certificate, ownerName: "Another Owner" },
        }),
      "CERTIFICATE_OWNER_MISMATCH",
    );
    await expectLguError(
      () =>
        service.startOrResumeApplication({
          actor,
          applicant,
          certificate: {
            ...certificate,
            businessAddress: { ...certificate.businessAddress, barangay: "" },
          },
        }),
      "INVALID_CERTIFICATE",
    );
  });

  test("authorizes status access through the trusted eGov actor", async () => {
    const { actor, applicant, service } = setup();
    const application = await service.startOrResumeApplication({
      actor,
      applicant,
      certificate,
    });

    await expectLguError(
      () =>
        service.getStatus({
          actor: { egovUserId: "another-user" },
          applicationId: application.applicationId,
        }),
      "APPLICATION_ACCESS_DENIED",
    );
  });

  test("abandons an unpaid application and permits a clean replacement", async () => {
    const { actor, applicant, repository, service } = setup();
    const first = await service.startOrResumeApplication({
      actor,
      applicant,
      certificate,
    });
    const abandoned = await service.abandonApplication({
      actor,
      applicationId: first.applicationId,
    });
    const replacement = await service.startOrResumeApplication({
      actor,
      applicant,
      certificate,
    });

    expect(abandoned.state).toBe("ABANDONED");
    expect(replacement.applicationId).not.toBe(first.applicationId);
    expect(repository.applications.get(first.applicationId)?.state).toBe("ABANDONED");
  });
});
