import { describe, expect, test } from "bun:test";

import { createEgovPayClientFromEnv, eGovPayApi, egovPayCatalog } from "../src/eGovPay/index.js";

describe("eGovPay", () => {
  test("injects the service env values and computes the payment digest", async () => {
    let capturedRequest: Request | undefined;
    const client = createEgovPayClientFromEnv({
      baseUrl: "https://pay.example.test",
      env: {
        EGOVPAY_API_KEY: "test_api_key",
        EGOVPAY_SETTLEMENT_TEMPLATE_UUID: "template-uuid",
      },
      fetch: async (input, init) => {
        capturedRequest = new Request(input, init);
        return Response.json({ data: {} }, { status: 201 });
      },
    });

    await client.generatePayment({
      amount: 1000,
      callbackUrl: "https://merchant.test/callback",
      items: [{ amount: 1000, name: "Fee" }],
      redirectUrl: "https://merchant.test/complete",
      transactionId: "TXN-1",
    });

    const body = (await capturedRequest?.json()) as Record<string, unknown>;
    expect(capturedRequest?.headers.get("x-egovpay-token")).toBe("test_api_key");
    expect(body.settlement_template_uuid).toBe("template-uuid");
    expect(body.digest).toMatch(/^[a-f0-9]{64}$/);
  });

  test("maps detail and void operations to their UUID paths", async () => {
    const requests: Request[] = [];
    const client = createEgovPayClientFromEnv({
      baseUrl: "https://pay.example.test",
      env: {
        EGOVPAY_API_KEY: "test_api_key",
        EGOVPAY_SETTLEMENT_TEMPLATE_UUID: "template-uuid",
      },
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json({ data: {} });
      },
    });

    await client.getTransaction("transaction-uuid");
    await client.voidTransaction("transaction-uuid");

    expect(requests.map(({ method, url }) => [method, new URL(url).pathname])).toEqual([
      ["GET", "/api/v1/transaction/transaction-uuid"],
      ["PUT", "/api/v1/transaction/transaction-uuid/void"],
    ]);
  });

  test("publishes the three operations through the service boundary", () => {
    expect(egovPayCatalog.endpoints).toHaveLength(3);
    expect(eGovPayApi.catalog).toBe(egovPayCatalog);
  });
});
