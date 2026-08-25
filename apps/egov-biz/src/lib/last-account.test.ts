import { describe, expect, test } from "bun:test";
import { maskMobile } from "@/lib/last-account";

describe("maskMobile", () => {
  test("masks the middle digits of a PH mobile number", () => {
    expect(maskMobile("+639925555602")).toBe("+63992***5602");
  });

  test("strips spaces and separators before masking", () => {
    expect(maskMobile("+63 992 555 5602")).toBe("+63992***5602");
  });

  test("returns an empty string for short or missing numbers", () => {
    expect(maskMobile("")).toBe("");
    expect(maskMobile("12345")).toBe("");
  });
});
