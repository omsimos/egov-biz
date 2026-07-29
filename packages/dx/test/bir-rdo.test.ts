import { describe, expect, test } from "bun:test";

import { assignDemoRdo } from "../src/bir/index.js";

describe("BIR demo RDO assignment", () => {
  test("returns a random code-only RDO", () => {
    const first = assignDemoRdo(() => 0);
    const last = assignDemoRdo(() => 0.999_999);

    expect(first).toEqual({
      code: "043",
      label: "RDO 043",
      simulated: true,
    });
    expect(last).toEqual({ code: "082", label: "RDO 082", simulated: true });
    expect(first).not.toHaveProperty("city");
    expect(last).not.toHaveProperty("city");
  });

  test("rejects an invalid random source", () => {
    expect(() => assignDemoRdo(() => 1)).toThrow("random source");
  });
});
