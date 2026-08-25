import { describe, expect, test } from "bun:test";
import { lguPaymentEnvironment } from "@/server/dx/lgu";

describe("business app LGU composition", () => {
  test("reuses the common eGovPay account by default", () => {
    expect(
      lguPaymentEnvironment({
        EGOVPAY_API_KEY: " common-key ",
        EGOVPAY_BASE_URL: " https://payments.example.test ",
        EGOVPAY_SETTLEMENT_TEMPLATE_UUID: " common-template ",
      }),
    ).toEqual({
      apiKey: "common-key",
      baseUrl: "https://payments.example.test",
      settlementTemplateUuid: "common-template",
    });
  });

  test("prefers the LGU-specific eGovPay account when configured", () => {
    expect(
      lguPaymentEnvironment({
        EGOVPAY_API_KEY: "common-key",
        EGOVPAY_BASE_URL: "https://common.example.test",
        EGOVPAY_SETTLEMENT_TEMPLATE_UUID: "common-template",
        LGU_EGOVPAY_API_KEY: "lgu-key",
        LGU_EGOVPAY_BASE_URL: "https://lgu.example.test",
        LGU_EGOVPAY_SETTLEMENT_TEMPLATE_UUID: "lgu-template",
      }),
    ).toEqual({
      apiKey: "lgu-key",
      baseUrl: "https://lgu.example.test",
      settlementTemplateUuid: "lgu-template",
    });
  });
});
