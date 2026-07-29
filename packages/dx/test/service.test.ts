import { describe, expect, test } from "bun:test";

import { BnrsError, createBnrsService } from "../src/bnrs/index.js";
import { MemoryBnrsRepository } from "./support/memory-repository.js";

const NOW = new Date("2026-07-29T08:30:00.000Z");

function setup() {
  const repository = new MemoryBnrsRepository();
  const service = createBnrsService({ repository, now: () => NOW });
  const actor = { egovUserId: "egov-user-1" };
  return { actor, repository, service };
}

async function expectBnrsError(action: () => Promise<unknown>, code: BnrsError["code"]) {
  try {
    await action();
    throw new Error("Expected a BnrsError");
  } catch (error) {
    expect(error).toBeInstanceOf(BnrsError);
    expect((error as BnrsError).code).toBe(code);
  }
}

describe("BNRS registration workflow", () => {
  test("lists only the authenticated user's completed business-name registrations", async () => {
    const { actor, repository, service } = setup();
    const older = await service.startOrResumeApplication({ actor });
    Object.assign(repository.applications.get(older.applicationId)!, {
      state: "COMPLETED" as const,
      dominantName: "Molar Bear",
      descriptorId: "DENTAL_CLINIC",
      descriptorLabel: "DENTAL CLINIC",
      proposedBusinessName: "Molar Bear Dental Clinic",
      normalizedBusinessName: "MOLAR BEAR DENTAL CLINIC",
      scope: "NATIONAL" as const,
      referenceCode: "BNRS-20260601-AAAAAAAA",
      issuedAt: new Date("2026-06-01T08:00:00.000Z"),
      createdAt: new Date("2026-07-20T07:00:00.000Z"),
    });

    const newer = await service.startOrResumeApplication({ actor });
    Object.assign(repository.applications.get(newer.applicationId)!, {
      state: "COMPLETED" as const,
      dominantName: "Daily Grind",
      descriptorId: "COFFEE_SHOP",
      descriptorLabel: "COFFEE SHOP",
      proposedBusinessName: "Daily Grind Coffee Shop",
      normalizedBusinessName: "DAILY GRIND COFFEE SHOP",
      scope: "CITY_MUNICIPALITY" as const,
      referenceCode: "BNRS-20260701-BBBBBBBB",
      issuedAt: new Date("2026-07-01T08:00:00.000Z"),
      createdAt: new Date("2026-05-01T07:00:00.000Z"),
    });

    await service.startOrResumeApplication({ actor });
    const otherUser = await service.startOrResumeApplication({
      actor: { egovUserId: "egov-user-2" },
    });
    Object.assign(repository.applications.get(otherUser.applicationId)!, {
      state: "COMPLETED" as const,
      proposedBusinessName: "Someone Else Online Shop",
      descriptorLabel: "ONLINE SHOP",
      scope: "REGIONAL" as const,
      referenceCode: "BNRS-20260715-CCCCCCCC",
      issuedAt: new Date("2026-07-15T08:00:00.000Z"),
      createdAt: new Date("2026-07-15T07:00:00.000Z"),
    });

    await expect(service.listRegisteredBusinesses({ actor })).resolves.toEqual([
      {
        applicationId: newer.applicationId,
        referenceCode: "BNRS-20260701-BBBBBBBB",
        businessName: "Daily Grind Coffee Shop",
        descriptor: "COFFEE SHOP",
        scope: "CITY_MUNICIPALITY",
        issuedAt: "2026-07-01T08:00:00.000Z",
      },
      {
        applicationId: older.applicationId,
        referenceCode: "BNRS-20260601-AAAAAAAA",
        businessName: "Molar Bear Dental Clinic",
        descriptor: "DENTAL CLINIC",
        scope: "NATIONAL",
        issuedAt: "2026-06-01T08:00:00.000Z",
      },
    ]);
  });

  test("starts or resumes the single active application", async () => {
    const { actor, service } = setup();
    const first = await service.startOrResumeApplication({ actor });
    const resumed = await service.startOrResumeApplication({ actor });

    expect(resumed.applicationId).toBe(first.applicationId);
    expect(first).toMatchObject({
      state: "TERMS_PENDING",
      completedSteps: [],
      nextStep: "TERMS_AND_CONDITIONS",
      ownerInformation: { stored: false },
    });
    expect(first).not.toHaveProperty("egovUserId");
  });

  test("enforces the ordered terms, owner, business-name, and scope transitions", async () => {
    const { actor, repository, service } = setup();
    const started = await service.startOrResumeApplication({ actor });

    await expectBnrsError(
      () =>
        service.setOwnerInformation({
          actor,
          applicationId: started.applicationId,
          owner: { firstName: "Genrev" },
        }),
      "INVALID_APPLICATION_STATE",
    );

    const terms = await service.acceptTermsAndConditions({
      actor,
      applicationId: started.applicationId,
    });
    expect(terms).toMatchObject({
      state: "OWNER_INFORMATION_PENDING",
      termsAcceptedAt: NOW.toISOString(),
    });

    const owner = await service.setOwnerInformation({
      actor,
      applicationId: started.applicationId,
      owner: { firstName: "Genrev", lastName: "Zapa" },
    });
    expect(owner.state).toBe("BUSINESS_NAME_PENDING");
    expect(repository.owners.get(started.applicationId)).toEqual({
      firstName: "Genrev",
      lastName: "Zapa",
    });
    expect(JSON.stringify(owner)).not.toContain("Genrev");

    await expectBnrsError(
      () =>
        service.setBusinessName({
          actor,
          applicationId: started.applicationId,
          dominantName: "Molar Bear",
          descriptorId: "INVENTED_DESCRIPTOR",
        }),
      "INVALID_DESCRIPTOR",
    );

    const named = await service.setBusinessName({
      actor,
      applicationId: started.applicationId,
      dominantName: "  Molar   Bear ",
      descriptorId: "DENTAL_CLINIC",
    });
    expect(named).toMatchObject({
      state: "SCOPE_PENDING",
      businessName: {
        dominantName: "Molar Bear",
        descriptorId: "DENTAL_CLINIC",
        descriptor: "DENTAL CLINIC",
        proposedBusinessName: "Molar Bear Dental Clinic",
      },
    });

    const scoped = await service.setBusinessScope({
      actor,
      applicationId: started.applicationId,
      scopeId: "NATIONAL",
    });
    expect(scoped).toMatchObject({
      state: "PAYMENT_READY",
      nextStep: "PAYMENT",
      scope: { registrationFee: 2_000, documentaryStampTax: 30, totalFee: 2_030 },
    });
  });

  test("allows name and scope edits until payment begins", async () => {
    const { actor, service } = setup();
    const application = await service.startOrResumeApplication({ actor });
    await service.acceptTermsAndConditions({ actor, applicationId: application.applicationId });
    await service.setOwnerInformation({
      actor,
      applicationId: application.applicationId,
      owner: {},
    });
    await service.setBusinessName({
      actor,
      applicationId: application.applicationId,
      dominantName: "First Name",
      descriptorId: "ONLINE_SHOP",
    });
    await service.setBusinessScope({
      actor,
      applicationId: application.applicationId,
      scopeId: "REGIONAL",
    });

    const renamed = await service.setBusinessName({
      actor,
      applicationId: application.applicationId,
      dominantName: "Second Name",
      descriptorId: "I_T_SOLUTIONS",
    });
    const rescoped = await service.setBusinessScope({
      actor,
      applicationId: application.applicationId,
      scopeId: "CITY_MUNICIPALITY",
    });

    expect(renamed.state).toBe("PAYMENT_READY");
    expect(renamed.businessName?.proposedBusinessName).toBe("Second Name I.T. Solutions");
    expect(rescoped.scope?.totalFee).toBe(530);
  });

  test("rejects access by another eGov user", async () => {
    const { actor, service } = setup();
    const application = await service.startOrResumeApplication({ actor });

    await expectBnrsError(
      () =>
        service.getStatus({
          actor: { egovUserId: "another-user" },
          applicationId: application.applicationId,
        }),
      "APPLICATION_ACCESS_DENIED",
    );
  });

  test("checks availability only against pending-payment and completed records", async () => {
    const { actor, repository, service } = setup();
    const first = await service.startOrResumeApplication({ actor });
    await service.acceptTermsAndConditions({ actor, applicationId: first.applicationId });
    await service.setOwnerInformation({ actor, applicationId: first.applicationId, owner: {} });
    await service.setBusinessName({
      actor,
      applicationId: first.applicationId,
      dominantName: "Shared Name",
      descriptorId: "ONLINE_SHOP",
    });
    await service.setBusinessScope({
      actor,
      applicationId: first.applicationId,
      scopeId: "NATIONAL",
    });

    const secondActor = { egovUserId: "egov-user-2" };
    const second = await service.startOrResumeApplication({ actor: secondActor });
    await service.acceptTermsAndConditions({
      actor: secondActor,
      applicationId: second.applicationId,
    });
    await service.setOwnerInformation({
      actor: secondActor,
      applicationId: second.applicationId,
      owner: {},
    });

    await service.setBusinessName({
      actor: secondActor,
      applicationId: second.applicationId,
      dominantName: "Shared Name",
      descriptorId: "ONLINE_SHOP",
    });

    const firstRecord = repository.applications.get(first.applicationId)!;
    firstRecord.state = "PAYMENT_PENDING";
    await expectBnrsError(
      () =>
        service.setBusinessName({
          actor: secondActor,
          applicationId: second.applicationId,
          dominantName: "Shared Name",
          descriptorId: "ONLINE_SHOP",
        }),
      "BUSINESS_NAME_UNAVAILABLE",
    );
  });

  test("abandons an unfinished application without deleting its history", async () => {
    const { actor, repository, service } = setup();
    const application = await service.startOrResumeApplication({ actor });

    const abandoned = await service.abandonApplication({
      actor,
      applicationId: application.applicationId,
    });
    const replacement = await service.startOrResumeApplication({ actor });

    expect(abandoned).toMatchObject({ state: "ABANDONED", nextStep: null });
    expect(replacement.applicationId).not.toBe(application.applicationId);
    expect(repository.applications.get(application.applicationId)?.state).toBe("ABANDONED");
  });

  test("makes retries idempotent after a step has advanced", async () => {
    const { actor, service } = setup();
    const application = await service.startOrResumeApplication({ actor });

    const first = await service.acceptTermsAndConditions({
      actor,
      applicationId: application.applicationId,
    });
    const retried = await service.acceptTermsAndConditions({
      actor,
      applicationId: application.applicationId,
    });

    expect(retried.state).toBe("OWNER_INFORMATION_PENDING");
    expect(retried.termsAcceptedAt).toBe(first.termsAcceptedAt);
  });
});
