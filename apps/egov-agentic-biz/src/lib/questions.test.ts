import { describe, expect, test } from "bun:test";
import { initialIntakeQuestionValue, type IntakeQuestion } from "@/lib/questions";

const descriptorQuestion: IntakeQuestion = {
  id: "business-descriptor",
  eyebrow: "Business identity",
  title: "Which descriptor best matches?",
  helpText: "Choose one.",
  type: "single",
  options: [
    { id: "ONLINE_SHOP", label: "ONLINE SHOP" },
    { id: "COFFEE_SHOP", label: "COFFEE SHOP" },
  ],
  suggestedOptionId: "COFFEE_SHOP",
};

describe("initialIntakeQuestionValue", () => {
  test("preselects a suggested option that belongs to the question", () => {
    expect(initialIntakeQuestionValue(descriptorQuestion)).toBe("COFFEE_SHOP");
  });

  test("does not select a suggestion outside the question options", () => {
    expect(
      initialIntakeQuestionValue({ ...descriptorQuestion, suggestedOptionId: "MADE_UP_SHOP" }),
    ).toBe("");
  });

  test("keeps multi-select questions empty", () => {
    expect(initialIntakeQuestionValue({ ...descriptorQuestion, type: "multi" })).toEqual([]);
  });
});
