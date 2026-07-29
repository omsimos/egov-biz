import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createDatabase, migrateDatabase } from "@repo/db";

import { createBnrsService, createDrizzleBnrsRepository } from "../src/bnrs/index.js";
import { createDrizzleLguRepository, createLguService } from "../src/lgu/index.js";
import { FakePaymentProvider } from "./support/fake-payment-provider.js";

const NOW = new Date("2026-07-29T08:30:00.000Z");

describe("BNRS to LGU handoff", () => {
  test("uses an actor-scoped BNRS certificate with its structured business address", async () => {
    const actor = { egovUserId: "egov-user-1" };
    const directory = mkdtempSync(join(tmpdir(), "egov-dx-turso-"));
    const database = createDatabase(pathToFileURL(join(directory, "dx.sqlite")).href);
    try {
      await migrateDatabase(database, new URL("../../db/drizzle", import.meta.url).pathname);
      const bnrsRepository = createDrizzleBnrsRepository(database);
      const paymentProvider = new FakePaymentProvider();
      const identifiers = [
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      ];
      const bnrs = createBnrsService({
        repository: bnrsRepository,
        paymentProvider,
        now: () => NOW,
        generateId: () => identifiers.shift() ?? crypto.randomUUID(),
      });

      const application = await bnrs.startOrResumeApplication({ actor });
      await bnrs.acceptTermsAndConditions({ actor, applicationId: application.applicationId });
      await bnrs.setOwnerInformation({
        actor,
        applicationId: application.applicationId,
        owner: { firstName: "Mara", lastName: "Reyes" },
      });
      await bnrs.setBusinessName({
        actor,
        applicationId: application.applicationId,
        dominantName: "Molar Bear",
        descriptorId: "DENTAL_CLINIC",
      });
      await bnrs.setBusinessScope({
        actor,
        applicationId: application.applicationId,
        scopeId: "CITY_MUNICIPALITY",
      });
      await bnrs.setBusinessAddress({
        actor,
        applicationId: application.applicationId,
        address: {
          source: "USER_PROVIDED",
          addressLine1: "12 Acacia Street",
          barangay: "Poblacion",
          cityMunicipality: "Makati City",
          province: "Metro Manila",
          region: "National Capital Region",
          postalCode: "1210",
        },
      });
      const checkout = await bnrs.createPayment({
        actor,
        applicationId: application.applicationId,
        callbackUrl: "https://app.example.test/bnrs/callback",
        redirectUrl: "https://app.example.test/bnrs/return",
      });
      paymentProvider.updateTransaction(checkout.transactionUuid, {
        status: "PAID",
        providerStatus: "paid",
        paidAt: NOW,
      });
      const completed = await bnrs.syncPaymentStatus({
        transactionUuid: checkout.transactionUuid,
      });
      if (!completed.registration) throw new Error("Expected BNRS registration to complete.");
      const certificate = await bnrs.getCertificate({
        actor,
        certificateNumber: completed.registration.certificateNumber,
      });

      const lgu = createLguService({
        repository: createDrizzleLguRepository(database),
        now: () => NOW,
      });
      const lguApplication = await lgu.startOrResumeApplication({
        actor,
        applicant: { ownerName: "Mara Reyes" },
        certificate,
      });

      expect(lguApplication).toMatchObject({
        state: "PAYMENT_READY",
        city: "Makati City",
        certificate: {
          certificateNumber: certificate.certificateNumber,
          businessAddress: certificate.businessAddress,
        },
      });
    } finally {
      database.$client.close();
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
