import { describe, expect, test } from "bun:test";
import { isExplicitBirFormRequest } from "@/lib/bir-form/request";

describe("isExplicitBirFormRequest", () => {
  test("recognizes explicit generation instructions", () => {
    expect(isExplicitBirFormRequest("Generate my BIR Form 1901 PDF.")).toBe(true);
    expect(isExplicitBirFormRequest("Can you prefill a BIR form for me?")).toBe(true);
    expect(isExplicitBirFormRequest("BIR 1901—please create it now.")).toBe(true);
    expect(isExplicitBirFormRequest("Fill out BIR Form 1905 for my address update.")).toBe(true);
  });

  test("does not invoke for questions or unrelated BIR discussion", () => {
    expect(isExplicitBirFormRequest("What is BIR Form 1901?")).toBe(false);
    expect(isExplicitBirFormRequest("What is BIR Form 1905?")).toBe(false);
    expect(isExplicitBirFormRequest("Do I need a BIR form for this business?")).toBe(false);
    expect(isExplicitBirFormRequest("Prepare my DTI registration form.")).toBe(false);
  });
});
