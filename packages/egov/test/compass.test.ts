import { describe, expect, test } from "bun:test";

import {
  compassCatalog,
  createCompassClientFromEnv,
  eGovCompassApi,
} from "../src/eGovCompass/index.js";

describe("Compass", () => {
  test("binds EGOVCOMPASS_API_KEY and serializes SAAODB filters", async () => {
    let capturedRequest: Request | undefined;
    const client = createCompassClientFromEnv({
      baseUrl: "https://compass.example.test",
      env: { EGOVCOMPASS_API_KEY: "api-key" },
      fetch: async (input, init) => {
        capturedRequest = new Request(input, init);
        return Response.json({ data: [], limit: 100, page: 1, total: 0 });
      },
    });

    await client.getSaaodbRecords({
      class: "PS",
      entityName: "Agriculture",
      limit: 100,
      page: 1,
      period: "FY",
      reportYear: 2026,
      sheetScope: "summary",
    });

    const url = new URL(capturedRequest?.url ?? "");
    expect(url.pathname).toBe("/api/v1/records/saaodb");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      class: "PS",
      entityName: "Agriculture",
      limit: "100",
      page: "1",
      period: "FY",
      reportYear: "2026",
      sheetScope: "summary",
    });
    expect(capturedRequest?.headers.get("x-api-key")).toBe("api-key");
  });

  test("keeps each record family on its documented path", async () => {
    const requests: Request[] = [];
    const client = createCompassClientFromEnv({
      baseUrl: "https://compass.example.test",
      env: { EGOVCOMPASS_API_KEY: "api-key" },
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json({ data: [], limit: 100, page: 1, total: 0 });
      },
    });

    await client.getNcaRecords({ budgetYear: 2026 });
    await client.getSaroRecords({ saroNo: "SARO-001" });
    await client.getLgsfRecords({ programCode: "FALGU" });
    await client.getLgsfDashboard({ programCode: "FALGU", reportYear: 2026 });

    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      "/api/v1/records/nca",
      "/api/v1/records/saro",
      "/api/v1/records/lgsf",
      "/api/v1/records/lgsf/dashboard",
    ]);
  });

  test("publishes all seven documented endpoints", () => {
    expect(compassCatalog.endpoints).toHaveLength(7);
    expect(eGovCompassApi.catalog).toBe(compassCatalog);
  });
});
