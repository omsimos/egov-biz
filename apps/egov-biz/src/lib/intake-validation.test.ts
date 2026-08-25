import { describe, expect, test } from "bun:test";
import { fallbackQuestionFor } from "@/lib/business-rules";
import { isValidChoiceAnswer } from "@/lib/intake-validation";

describe("isValidChoiceAnswer", () => {
  test("accepts the none option for the no-employees answer", () => {
    const question = fallbackQuestionFor("I'm a VA freelancer", 1);

    expect(question.id).toBe("workers");
    expect(isValidChoiceAnswer(question, "none")).toBe(true);
  });

  test("rejects values that are not options on the question", () => {
    const question = fallbackQuestionFor("I'm a VA freelancer", 1);

    expect(isValidChoiceAnswer(question, "placeholder")).toBe(false);
  });
});
