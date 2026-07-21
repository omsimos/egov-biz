import { describe, expect, test } from "bun:test";
import { extractAnsweredLocation, resolveBusinessLocation } from "@/lib/government-data";

describe("business location answers", () => {
  const answers = [
    {
      questionId: "profile-address",
      labels: ["Use a different address"],
      value: "use-different-address",
    },
    {
      questionId: "business-address",
      labels: ["2 Market Street, Makati City"],
      value: "2 Market Street, Makati City",
    },
  ];

  test("ignores the profile-address preference and uses the actual business address", () => {
    expect(extractAnsweredLocation(answers)).toBe("2 Market Street, Makati City");
    expect(resolveBusinessLocation("Online shop", "Quezon City", answers)).toMatchObject({
      city: "Makati City",
      source: "answer",
    });
  });
});
