import { describe, expect, test } from "bun:test";
import { createSsoIntentToken, verifySsoIntentToken } from "@/lib/auth/intent";

describe("eGov SSO browser intent", () => {
  test("accepts a fresh token signed for this app", async () => {
    const token = await createSsoIntentToken("example-test-secret", 1_000);
    expect(await verifySsoIntentToken(token, "example-test-secret", 1_100)).toBe(true);
  });

  test("rejects tampered and expired intent tokens", async () => {
    const token = await createSsoIntentToken("example-test-secret", 1_000);
    expect(await verifySsoIntentToken(`${token}tampered`, "example-test-secret", 1_100)).toBe(
      false,
    );
    expect(await verifySsoIntentToken(token, "example-test-secret", 1_301)).toBe(false);
  });
});
