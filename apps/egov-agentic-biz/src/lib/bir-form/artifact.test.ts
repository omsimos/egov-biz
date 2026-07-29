import { describe, expect, test } from "bun:test";
import { mergeBir1901Data } from "@/lib/bir-form/artifact";

describe("mergeBir1901Data", () => {
  test("lets supplied form data override profile defaults without losing sibling values", () => {
    const merged = mergeBir1901Data(
      {
        taxpayerInformation: {
          taxpayerName: {
            firstName: "Profile First",
            lastName: "Profile Last",
          },
          contact: {
            email: "profile@example.test",
            preferredTypes: ["mobile"],
          },
        },
      },
      {
        taxpayerInformation: {
          taxpayerName: {
            firstName: "Supplied First",
          },
          contact: {
            preferredTypes: ["landline", "mobile"],
          },
        },
      },
    );

    expect(merged).toMatchObject({
      taxpayerInformation: {
        taxpayerName: {
          firstName: "Supplied First",
          lastName: "Profile Last",
        },
        contact: {
          email: "profile@example.test",
          preferredTypes: ["landline", "mobile"],
        },
      },
    });
  });
});
