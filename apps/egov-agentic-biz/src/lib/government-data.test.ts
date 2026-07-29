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

  test("prefers the structured city over an earlier work-location answer", () => {
    const structuredAnswers = [
      {
        questionId: "business-location",
        labels: ["From home"],
        value: "home",
      },
      {
        questionId: "business-city-municipality",
        labels: ["Makati City"],
        value: "Makati City",
      },
    ];

    expect(extractAnsweredLocation(structuredAnswers)).toBe("Makati City");
    expect(
      resolveBusinessLocation("I’m a freelancer", "CITY OF ALAMINOS", structuredAnswers),
    ).toMatchObject({
      city: "Makati City",
      source: "answer",
    });
  });
});
