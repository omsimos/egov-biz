import type { IntakeQuestion } from "@/lib/questions";

export function isValidChoiceAnswer(question: IntakeQuestion, value: string | string[]): boolean {
  if (question.type !== "single" && question.type !== "multi") return false;
  const selected = (Array.isArray(value) ? value : [value]).filter(Boolean);
  if (!selected.length) return false;
  const allowed = new Set(question.options?.map((option) => option.id) ?? []);
  return selected.every((optionId) => allowed.has(optionId));
}
