import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createDatabase, migrateDatabase } from "@omsimos/db";

import { getBnrs } from "@/server/dx/bnrs";

const previousDatabaseUrl = process.env.DX_TURSO_DATABASE_URL;
const previousAuthToken = process.env.DX_TURSO_AUTH_TOKEN;
const previousPaymentApiKey = process.env.EGOVPAY_API_KEY;
const previousPaymentBaseUrl = process.env.EGOVPAY_BASE_URL;
const previousPaymentTemplate = process.env.EGOVPAY_SETTLEMENT_TEMPLATE_UUID;
const directory = mkdtempSync(join(tmpdir(), "egov-biz-dx-bnrs-"));
const databaseUrl = pathToFileURL(join(directory, "dx.sqlite")).href;

beforeAll(async () => {
  process.env.DX_TURSO_DATABASE_URL = databaseUrl;
  delete process.env.DX_TURSO_AUTH_TOKEN;
  delete process.env.EGOVPAY_API_KEY;
  delete process.env.EGOVPAY_BASE_URL;
  delete process.env.EGOVPAY_SETTLEMENT_TEMPLATE_UUID;

  const database = createDatabase(databaseUrl);
  try {
    await migrateDatabase(
      database,
      fileURLToPath(new URL("../../../../../packages/db/drizzle", import.meta.url)),
    );
  } finally {
    database.$client.close();
  }
});

afterAll(() => {
  if (previousDatabaseUrl === undefined) delete process.env.DX_TURSO_DATABASE_URL;
  else process.env.DX_TURSO_DATABASE_URL = previousDatabaseUrl;
  if (previousAuthToken === undefined) delete process.env.DX_TURSO_AUTH_TOKEN;
  else process.env.DX_TURSO_AUTH_TOKEN = previousAuthToken;
  if (previousPaymentApiKey === undefined) delete process.env.EGOVPAY_API_KEY;
  else process.env.EGOVPAY_API_KEY = previousPaymentApiKey;
  if (previousPaymentBaseUrl === undefined) delete process.env.EGOVPAY_BASE_URL;
  else process.env.EGOVPAY_BASE_URL = previousPaymentBaseUrl;
  if (previousPaymentTemplate === undefined) delete process.env.EGOVPAY_SETTLEMENT_TEMPLATE_UUID;
  else process.env.EGOVPAY_SETTLEMENT_TEMPLATE_UUID = previousPaymentTemplate;
  rmSync(directory, { force: true, recursive: true });
});

describe("business app BNRS composition", () => {
  test("caches one DX service and keeps catalog reads independent of eGovPay configuration", () => {
    const bnrs = getBnrs();

    expect(getBnrs()).toBe(bnrs);
    expect(bnrs.getTermsAndConditions().length).toBeGreaterThan(100);
    expect(bnrs.getBusinessNameRequirements().descriptors).toHaveLength(40);
    expect(bnrs.getBusinessScopes().map(({ id, totalFee }) => ({ id, totalFee }))).toEqual([
      { id: "CITY_MUNICIPALITY", totalFee: 530 },
      { id: "REGIONAL", totalFee: 1_030 },
      { id: "NATIONAL", totalFee: 2_030 },
    ]);
  });

  test("reads through the real local Drizzle repository", async () => {
    await expect(
      getBnrs().listRegisteredBusinesses({ actor: { egovUserId: "phase-1-read-only-test" } }),
    ).resolves.toEqual([]);
  });
});
