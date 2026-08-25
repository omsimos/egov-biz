import { describe, expect, test } from "bun:test";
import { describesBusinessIdea, isRegistrationStart } from "@/lib/registration-intent";

describe("registration intent", () => {
  test("recognizes a VA freelancer identity statement as a business description", () => {
    expect(describesBusinessIdea("I'm a VA freelancer")).toBe(true);
  });

  test("recognizes freelancer wording in explicit registration requests", () => {
    expect(isRegistrationStart("I want to register as a freelancer")).toBe(true);
  });

  test("does not turn an unrelated use of available into a VA registration", () => {
    expect(describesBusinessIdea("What services are available today?")).toBe(false);
  });
});
