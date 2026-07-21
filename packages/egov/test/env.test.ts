import { describe, expect, test } from "bun:test";

import { requireEgovEnvironment } from "../src/core/env.js";

describe("requireEgovEnvironment", () => {
  test("returns a trimmed service-prefixed value", () => {
    expect(
      requireEgovEnvironment("EGOVSSO_PARTNER_CODE", {
        EGOVSSO_PARTNER_CODE: "  partner-code  ",
      }),
    ).toBe("partner-code");
  });

  test("names the missing variable without exposing other values", () => {
    expect(() => requireEgovEnvironment("EVERIFY_CLIENT_SECRET", {})).toThrow(
      "Missing required eGov environment variable: EVERIFY_CLIENT_SECRET",
    );
  });
});
