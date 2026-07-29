import type { IntakeQuestion } from "@/lib/questions";

const PLACEHOLDER_ANSWER =
  /^(?:a+s+s+|asdf+|test(?:ing)?|sample|placeholder|none|n\/?a|not sure|unknown|idk|tbd|xxx+|-+)$/i;

export function isPlaceholderAnswer(value: string) {
  return PLACEHOLDER_ANSWER.test(value.trim());
}

export function isValidChoiceAnswer(question: IntakeQuestion, value: string | string[]): boolean {
  if (question.type !== "single" && question.type !== "multi") return false;
  const selected = (Array.isArray(value) ? value : [value]).filter(Boolean);
  if (!selected.length) return false;
  const allowed = new Set(question.options?.map((option) => option.id) ?? []);
  return selected.every((optionId) => allowed.has(optionId));
}
