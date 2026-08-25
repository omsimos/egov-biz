export function isExplicitBirFormRequest(value: string) {
  const action = String.raw`(?:generate|create|prepare|prefill|pre-fill|fill(?:\s+out)?|make)`;
  const form = String.raw`(?:BIR(?:\s+Form)?\s*(?:1901|1905)|BIR\s+form)`;
  return (
    new RegExp(String.raw`\b${action}\b[\s\S]{0,100}\b${form}\b`, "i").test(value) ||
    new RegExp(String.raw`\b${form}\b[\s\S]{0,100}\b${action}\b`, "i").test(value)
  );
}
