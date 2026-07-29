import { describe, expect, test } from "bun:test";

import { createBirDemoTaxCalendar } from "../src/bir/index.js";

const asOf = new Date("2026-07-30T00:00:00.000Z");

describe("BIR demo tax calendar", () => {
  test("creates four sorted, future, explicitly simulated reminders", () => {
    const calendar = createBirDemoTaxCalendar({
      businessType: "Self-employed",
      asOf,
    });

    expect(calendar).toHaveLength(4);
    expect(calendar.map(({ dueDate }) => dueDate)).toEqual([
      "2026-08-15",
      "2026-10-25",
      "2027-01-31",
      "2027-04-15",
    ]);
    expect(calendar[0]?.status).toBe("Upcoming");
    expect(calendar.slice(1).every(({ status }) => status === "Scheduled")).toBe(true);
    expect(
      calendar.every(
        ({ businessType, dueDate, note, simulated }) =>
          businessType === "Self-employed" &&
          dueDate > "2026-07-30" &&
          simulated &&
          /demo|confirm/i.test(note),
      ),
    ).toBe(true);
  });

  test("varies income-tax reminders by legal business type", () => {
    const selfEmployed = createBirDemoTaxCalendar({
      businessType: "Self-employed",
      asOf,
    });
    const soleProprietor = createBirDemoTaxCalendar({
      businessType: "Sole proprietor",
      asOf,
    });
    const company = createBirDemoTaxCalendar({ businessType: "Company", asOf });

    expect(selfEmployed.map(({ formCode }) => formCode)).toContain("BIR Form 1701A");
    expect(soleProprietor.map(({ formCode }) => formCode)).toContain("BIR Form 1701");
    expect(company.map(({ formCode }) => formCode)).toEqual(
      expect.arrayContaining(["BIR Form 0619E", "BIR Form 1702Q", "BIR Form 1702-RT"]),
    );
    expect(company.map(({ formCode }) => formCode)).not.toContain("BIR Form 1701Q");
  });

  test("keeps a reminder due on the reference calendar day", () => {
    const calendar = createBirDemoTaxCalendar({
      businessType: "Self-employed",
      asOf: new Date("2026-08-15T23:59:59.000Z"),
    });

    expect(calendar[0]?.dueDate).toBe("2026-08-15");
  });

  test("rejects an invalid reference date", () => {
    expect(() =>
      createBirDemoTaxCalendar({
        businessType: "Sole proprietor",
        asOf: new Date(Number.NaN),
      }),
    ).toThrow("reference date must be valid");
  });
});
