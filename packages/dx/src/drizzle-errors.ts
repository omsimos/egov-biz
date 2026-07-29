export function databaseErrorContains(error: unknown, needle: string): boolean {
  let current = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (current instanceof Error && current.message.includes(needle)) return true;
    if (typeof current !== "object") return false;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
