import { describe, expect, test } from "bun:test";
import { getTableConfig } from "drizzle-orm/sqlite-core";

import { lguApplicantInformation, lguApplications, lguPayments } from "../src/schema.js";

describe("LGU schema", () => {
  test("defines isolated application, applicant, and payment tables", () => {
    expect(getTableConfig(lguApplications).name).toBe("lgu_applications");
    expect(getTableConfig(lguApplicantInformation).name).toBe("lgu_applicant_information");
    expect(getTableConfig(lguPayments).name).toBe("lgu_payments");
  });

  test("enforces one non-abandoned application per owner, certificate, and city", () => {
    const config = getTableConfig(lguApplications);
    const indexes = config.indexes.map(({ config: index }) => index);

    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "lgu_one_application_per_business_city",
          unique: true,
          where: expect.anything(),
        }),
        expect.objectContaining({
          name: "lgu_permit_number_unique",
          unique: true,
          where: expect.anything(),
        }),
        expect.objectContaining({
          name: "lgu_barangay_clearance_number_unique",
          unique: true,
          where: expect.anything(),
        }),
      ]),
    );
    expect(config.columns.find(({ name }) => name === "latest_payment_id")).toBeDefined();
    expect(config.columns.find(({ name }) => name === "certificate_number")).toBeDefined();
    expect(config.columns.find(({ name }) => name === "normalized_city")).toBeDefined();
    expect(config.columns.find(({ name }) => name === "business_address_line_1")?.notNull).toBe(
      true,
    );
    expect(config.columns.find(({ name }) => name === "business_barangay")?.notNull).toBe(true);
    expect(config.columns.find(({ name }) => name === "business_province")?.notNull).toBe(true);
    expect(config.columns.find(({ name }) => name === "business_region")?.notNull).toBe(true);
    expect(config.columns.find(({ name }) => name === "business_postal_code")?.notNull).toBe(true);
    expect(config.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "lgu_certificate_dates_valid" }),
        expect.objectContaining({ name: "lgu_issued_documents_complete" }),
      ]),
    );
  });

  test("isolates applicant information behind a one-to-one application foreign key", () => {
    const config = getTableConfig(lguApplicantInformation);

    expect(config.columns.find(({ name }) => name === "application_id")?.primary).toBe(true);
    expect(config.columns.find(({ name }) => name === "tin")).toBeDefined();
    expect(config.foreignKeys).toHaveLength(1);
  });

  test("preserves payment attempts while allowing only one current attempt", () => {
    const config = getTableConfig(lguPayments);
    const indexes = config.indexes.map(({ config: index }) => index);

    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "lgu_one_pending_payment_per_application",
          unique: true,
          where: expect.anything(),
        }),
        expect.objectContaining({
          name: "lgu_payment_transaction_uuid_unique",
          unique: true,
        }),
        expect.objectContaining({
          name: "lgu_payment_transaction_id_unique",
          unique: true,
        }),
      ]),
    );
    expect(config.foreignKeys).toHaveLength(1);
    expect(config.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "lgu_payment_assessment_fixed" }),
        expect.objectContaining({ name: "lgu_payment_provider_state_complete" }),
      ]),
    );
  });
});
