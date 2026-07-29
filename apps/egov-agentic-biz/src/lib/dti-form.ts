import { z } from "zod";
import { isCompleteBusinessAddress } from "@/lib/business-address";
import {
  businessAddressSources,
  type BusinessChatMessage,
  type DtiBusinessNameForm,
} from "@/lib/business-chat";
import { isPlaceholderAnswer } from "@/lib/intake-validation";

export function isMeaningfulBusinessName(value: string) {
  const text = value.trim().replace(/\s+/g, " ");
  return text.length >= 3 && /[a-z\d]/i.test(text) && !isPlaceholderAnswer(text);
}

export const readyDtiBusinessNameFormSchema = z.object({
  applicationType: z.literal("New registration"),
  status: z.enum(["Ready to submit", "Submitted"]),
  proposedName: z
    .string()
    .trim()
    .refine(isMeaningfulBusinessName, "A complete proposed business name is required"),
  businessActivity: z.string().trim().min(1),
  territorialScope: z.enum(["Barangay", "City / municipality", "Regional", "National"]),
  ownerName: z.string().trim().min(1),
  businessAddress: z
    .string()
    .trim()
    .refine(isCompleteBusinessAddress, "A complete business address is required"),
  businessAddressSource: z.enum(businessAddressSources),
  city: z.string().trim().min(1),
  feeLabel: z.string().trim().min(1),
  missingFields: z.array(z.string()).max(0),
});

export function latestReadyDtiBusinessNameForm(
  messages: ReadonlyArray<Pick<BusinessChatMessage, "parts">>,
): DtiBusinessNameForm | null {
  for (const message of [...messages].reverse())
    for (const part of [...message.parts].reverse()) {
      if (part.type !== "tool-editDtiBusinessNameForm" || part.state !== "output-available")
        continue;
      const parsed = readyDtiBusinessNameFormSchema.safeParse(part.output.form);
      return parsed.success ? parsed.data : null;
    }
  return null;
}
