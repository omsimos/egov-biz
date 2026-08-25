import { describe, expect, test } from "bun:test";
import { BNRS_DESCRIPTORS } from "@omsimos/dx/bnrs";
import {
  fallbackBnrsDescriptorSuggestion,
  orderBnrsDescriptorsWithSuggestionFirst,
  validBnrsDescriptorSuggestion,
} from "@/lib/bnrs-descriptor";

describe("BNRS descriptor suggestions", () => {
  test.each([
    ["I want to start a coffee subscription business", "COFFEE_SHOP"],
    ["I will sell clothes through an online store", "ONLINE_SHOP"],
    ["I am opening a dental practice", "DENTAL_CLINIC"],
    ["I offer accounting services", "ACCOUNTING_SERVICES"],
  ])("suggests an official descriptor for %s", (conversation, expected) => {
    expect(fallbackBnrsDescriptorSuggestion(conversation, BNRS_DESCRIPTORS)).toBe(expected);
  });

  test("rejects a model suggestion outside the official catalog", () => {
    expect(validBnrsDescriptorSuggestion("MADE_UP_SHOP", BNRS_DESCRIPTORS)).toBeNull();
    expect(validBnrsDescriptorSuggestion("COFFEE_SHOP", BNRS_DESCRIPTORS)).toBe("COFFEE_SHOP");
  });

  test("moves the suggested descriptor to the top without mutating the catalog", () => {
    const originalOrder = BNRS_DESCRIPTORS.map(({ id }) => id);
    const ordered = orderBnrsDescriptorsWithSuggestionFirst(BNRS_DESCRIPTORS, "COFFEE_SHOP");

    expect(ordered[0]?.id).toBe("COFFEE_SHOP");
    expect(ordered.slice(1).map(({ id }) => id)).toEqual(
      originalOrder.filter((id) => id !== "COFFEE_SHOP"),
    );
    expect(BNRS_DESCRIPTORS.map(({ id }) => id)).toEqual(originalOrder);
  });

  test("keeps the official order when there is no valid suggestion", () => {
    expect(orderBnrsDescriptorsWithSuggestionFirst(BNRS_DESCRIPTORS, null)).toEqual([
      ...BNRS_DESCRIPTORS,
    ]);
    expect(orderBnrsDescriptorsWithSuggestionFirst(BNRS_DESCRIPTORS, "MADE_UP_SHOP")).toEqual([
      ...BNRS_DESCRIPTORS,
    ]);
  });
});
