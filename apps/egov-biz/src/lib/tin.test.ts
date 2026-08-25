import { describe, expect, test } from "bun:test";
import { DUMMY_TIN_BY_SSO_EMAIL, FALLBACK_DUMMY_TIN, resolveSsoTin } from "@/lib/tin";

describe("resolveSsoTin", () => {
  test.each([
    ["josie@yopmail.com", "000001001000"],
    ["josie01@yopmail.com", "000002002000"],
    ["josie02@yopmail.com", "000003003000"],
    ["josie03@yopmail.com", "000004004000"],
    ["josie04@yopmail.com", "000005005000"],
  ])("maps %s to its dummy TIN", (email, tin) => {
    expect(resolveSsoTin({ email, tin_id: null })).toBe(tin);
    expect(DUMMY_TIN_BY_SSO_EMAIL[email]).toBe(tin);
  });

  test("keeps a valid TIN supplied by SSO", () => {
    expect(
      resolveSsoTin({
        email: "josie@yopmail.com",
        tin_id: "123-456-789-000",
      }),
    ).toBe("123456789000");
  });

  test("uses a fallback when no valid TIN or mapped email is available", () => {
    expect(resolveSsoTin({ email: "someone@example.test", tin_id: "invalid" })).toBe(
      FALLBACK_DUMMY_TIN,
    );
    expect(resolveSsoTin(undefined)).toBe(FALLBACK_DUMMY_TIN);
  });
});
