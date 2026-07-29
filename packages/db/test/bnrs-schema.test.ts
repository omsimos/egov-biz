import { describe, expect, test } from "bun:test";
import { getTableConfig } from "drizzle-orm/pg-core";

import {
  bnrsApplications,
  bnrsBusinessAddresses,
  bnrsOwnerInformation,
  bnrsPayments,
} from "../src/schema.js";

describe("BNRS schema", () => {
  test("defines the application, owner, business-address, and payment tables", () => {
    expect(getTableConfig(bnrsApplications).name).toBe("bnrs_applications");
    expect(getTableConfig(bnrsOwnerInformation).name).toBe("bnrs_owner_information");
    expect(getTableConfig(bnrsBusinessAddresses).name).toBe("bnrs_business_addresses");
    expect(getTableConfig(bnrsPayments).name).toBe("bnrs_payments");
  });

  test("enforces one active application and one reserved business name", () => {
    const config = getTableConfig(bnrsApplications);
    const indexes = config.indexes.map(({ config: index }) => index);

    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "bnrs_one_active_application_per_user",
          unique: true,
          where: expect.anything(),
        }),
        expect.objectContaining({
          name: "bnrs_reserved_business_name_unique",
          unique: true,
          where: expect.anything(),
        }),
      ]),
    );
    expect(config.columns.find(({ name }) => name === "latest_payment_id")).toBeDefined();
  });

  test("persists uniquely identified certificate validity", () => {
    const config = getTableConfig(bnrsApplications);
    const indexes = config.indexes.map(({ config: index }) => index);

    expect(config.columns.find(({ name }) => name === "certificate_number")).toBeDefined();
    expect(config.columns.find(({ name }) => name === "valid_until")).toBeDefined();
    expect(config.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "bnrs_certificate_issuance_complete" }),
      ]),
    );
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "bnrs_certificate_number_unique",
          unique: true,
          where: expect.anything(),
        }),
      ]),
    );
  });

  test("isolates owner details behind a one-to-one application foreign key", () => {
    const config = getTableConfig(bnrsOwnerInformation);

    expect(config.primaryKeys).toHaveLength(0);
    expect(config.columns.find(({ name }) => name === "application_id")?.primary).toBe(true);
    expect(config.foreignKeys).toHaveLength(1);
  });

  test("isolates the required business address behind a one-to-one application foreign key", () => {
    const config = getTableConfig(bnrsBusinessAddresses);

    expect(config.primaryKeys).toHaveLength(0);
    expect(config.columns.find(({ name }) => name === "application_id")?.primary).toBe(true);
    expect(config.columns.find(({ name }) => name === "source")?.notNull).toBe(true);
    expect(config.columns.find(({ name }) => name === "barangay")?.notNull).toBe(true);
    expect(config.columns.find(({ name }) => name === "city_municipality")?.notNull).toBe(true);
    expect(config.foreignKeys).toHaveLength(1);
  });

  test("preserves payment attempts while allowing only one pending attempt", () => {
    const config = getTableConfig(bnrsPayments);
    const indexes = config.indexes.map(({ config: index }) => index);

    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "bnrs_one_pending_payment_per_application",
          unique: true,
          where: expect.anything(),
        }),
        expect.objectContaining({
          name: "bnrs_payment_transaction_uuid_unique",
          unique: true,
        }),
        expect.objectContaining({
          name: "bnrs_payment_transaction_id_unique",
          unique: true,
        }),
      ]),
    );
    expect(config.foreignKeys).toHaveLength(1);
  });
});
