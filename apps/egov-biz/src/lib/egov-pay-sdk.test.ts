import { describe, expect, test } from "bun:test";
import { createEgovPayDigest } from "./egov-pay-sdk";

describe("eGovPay SDK integration", () => {
  test("uses the staging token without its routing prefix as the digest key", () => {
    expect(createEgovPayDigest(1000, "TXN-1", "test_api_key")).toBe(
      "d53d2d563e410d69899e106457449f5c80ef202c424bf4fb7384d741f6bc9114",
    );
  });

  test("uses production tokens unchanged", () => {
    expect(createEgovPayDigest(500, "TXN-2", "production_api_key")).toBe(
      "27d2b649af55b982b4f11342efe4dbb09ed0b22b452b373d18513fdf176ba23d",
    );
  });
});
