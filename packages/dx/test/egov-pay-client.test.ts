import { describe, expect, test } from "bun:test";
import { createClient } from "egov.js";
import { createEgovPayClient } from "../src/egov-pay.js";

describe("generated eGovPay client adapter", () => {
  test("maps application payment input to the generated SDK request", async () => {
    let request: Request | undefined;
    const client = createEgovPayClient({
      apiKey: "test_api_key",
      client: createClient({
        baseUrl: "https://pay.example.test",
        fetch: async (input, init) => {
          request = new Request(input, init);
          return Response.json(
            {
              data: {
                channel: { refno: "reference" },
                url: "https://pay.example.test/checkout",
                uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              },
            },
            { status: 201 },
          );
        },
      }),
      settlementTemplateUuid: "template-uuid",
    });

    await client.generatePayment({
      amount: 1000,
      callbackUrl: "https://merchant.example.test/callback",
      items: [{ amount: 1000, name: "Registration fee" }],
      redirectUrl: "https://merchant.example.test/complete",
      transactionId: "TXN-1",
    });

    expect(request?.headers.get("x-egovpay-token")).toBe("test_api_key");
    expect(await request?.json()).toEqual({
      amount: 1000,
      callback_url: "https://merchant.example.test/callback",
      digest: "d53d2d563e410d69899e106457449f5c80ef202c424bf4fb7384d741f6bc9114",
      items: [{ amount: 1000, name: "Registration fee" }],
      redirect_url: "https://merchant.example.test/complete",
      settlement_template_uuid: "template-uuid",
      txnid: "TXN-1",
    });
  });
});
