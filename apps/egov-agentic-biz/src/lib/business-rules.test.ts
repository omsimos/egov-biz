import { describe, expect, test } from "bun:test";
import { inferCategory } from "@/lib/business-rules";

describe("inferCategory", () => {
  test.each(["I'm a VA freelancer", "I work as a virtual assistant", "freelance writer"])(
    "classifies %s as professional services",
    (prompt) => {
      expect(inferCategory(prompt).category).toBe("professional-services");
    },
  );
});
