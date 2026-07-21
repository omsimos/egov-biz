import { describe, expect, test } from "bun:test";

import {
  createEReportClient,
  createEReportClientFromEnv,
  eReportApi,
  eReportCatalog,
} from "../src/eReport/index.js";

describe("eReport", () => {
  test("binds EREPORT_ACCESS_TOKEN to token generation", async () => {
    let capturedRequest: Request | undefined;
    const client = createEReportClientFromEnv({
      baseUrl: "https://ereport.example.test",
      env: { EREPORT_ACCESS_TOKEN: "access-code" },
      fetch: async (input, init) => {
        capturedRequest = new Request(input, init);
        return Response.json({ access_token: "integration-token", expires_at: "later" });
      },
    });

    await client.generateToken();

    expect(capturedRequest?.url).toBe("https://ereport.example.test/api/integration/token");
    expect(await capturedRequest?.json()).toEqual({ access_code: "access-code" });
  });

  test("maps dataset filters and bearer authentication", async () => {
    const requests: Request[] = [];
    const client = createEReportClient({
      baseUrl: "https://ereport.example.test",
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json({ data: [] });
      },
    });

    await client.listProvinces("integration-token", "040000000");
    await client.listMunicipalities("integration-token", "042100000");
    await client.listBarangays("integration-token", "042111000");

    expect(requests.map(({ url }) => url)).toEqual([
      "https://ereport.example.test/api/integration/datasets/provinces?region_code=040000000",
      "https://ereport.example.test/api/integration/datasets/municipalities?province_code=042100000",
      "https://ereport.example.test/api/integration/datasets/barangays?municipality_code=042111000",
    ]);
    expect(
      requests.every(
        (request) => request.headers.get("authorization") === "Bearer integration-token",
      ),
    ).toBe(true);
  });

  test("serializes a complaint and keeps report viewing on its dedicated token", async () => {
    const requests: Request[] = [];
    const client = createEReportClient({
      baseUrl: "https://ereport.example.test",
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json({ data: [] });
      },
    });

    await client.submitComplaint("integration-token", {
      barangayCode: "042111011",
      complainantEmail: "citizen@example.test",
      firstName: "Juan",
      gender: "Male",
      lastName: "Dela Cruz",
      message: "Details",
      mobile: "639000000000",
      municipalityCode: "042111000",
      provinceCode: "042100000",
      regionCode: "040000000",
      reportType: "crime",
      subject: "Subject",
    });
    await client.listReports("view-token", { limit: 10, page: 2, q: "subject" });
    await client.getReport("view-token", "PFM/001");

    expect(await requests[0]?.json()).toEqual({
      barangay_code: "042111011",
      complainant_email: "citizen@example.test",
      first_name: "Juan",
      gender: "Male",
      last_name: "Dela Cruz",
      message: "Details",
      mobile: "639000000000",
      municipality_code: "042111000",
      province_code: "042100000",
      region_code: "040000000",
      report_type: "crime",
      subject: "Subject",
    });
    expect(requests[1]?.url).toBe(
      "https://ereport.example.test/api/integration/reports?limit=10&page=2&q=subject",
    );
    expect(requests[1]?.headers.get("x-ereport-view-token")).toBe("view-token");
    expect(requests[2]?.url).toBe("https://ereport.example.test/api/integration/reports/PFM%2F001");
  });

  test("publishes all eleven documented operations", () => {
    expect(eReportCatalog.endpoints).toHaveLength(11);
    expect(eReportApi.catalog).toBe(eReportCatalog);
  });
});
