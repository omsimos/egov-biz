/** The only shape this walker follows: any thrown value may carry a `cause`. */
type ErrorCauseCarrier = { cause?: unknown };

// A thrown value is `unknown` by the language's own rules — every caller reaches
// this from a `catch` binding. The walker only tests it with `instanceof` and
// follows an optional `cause`; it never trusts a field.
// oxlint-disable-next-line anti-slop/no-unknown-parameters
export function databaseErrorContains(error: unknown, needle: string): boolean {
  let current = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (current instanceof Error && current.message.includes(needle)) return true;
    // Separating an object from a primitive or a function is what stops the walk,
    // and `typeof` is the only operator that draws that exact line. `instanceof
    // Object` would follow functions and would drop null-prototype objects.
    // oxlint-disable-next-line anti-slop/no-runtime-typeof
    if (typeof current !== "object") return false;
    // SAFETY: `current` is a non-null object here — the loop condition rejects
    // falsy values and the check above rejects everything else. A missing
    // `cause` reads back as `undefined`, which ends the walk on the next turn.
    current = (current as ErrorCauseCarrier).cause;
  }
  return false;
}
