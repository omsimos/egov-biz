import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dir, "..");

// Illustration components: the literal colours ARE the artwork, so they are
// exempt by design. This list is exhaustive — nothing else may carry a hex.
const ART_COMPONENTS = new Set([
  "components/egov-logo.tsx",
  "components/gov-seals.tsx",
  "components/flag-sunrise.tsx",
]);

// `themeColor` is browser chrome; it cannot read a CSS custom property.
const LITERAL_EXCEPTIONS = new Set(["app/layout.tsx"]);

// Screens still holding pre-tokenisation hexes. This set only ever SHRINKS.
// Removing the last entry is the goal of this pass; adding one is a regression.
// login-screen.tsx is deliberately absent: it carries no inline hex at all —
// all of its colour lives in bespoke CSS classes in globals.css, so Task 5's
// migration is not visible to this guard.
const PENDING = new Set<string>([]);

// Screens still using a native confirm(), alert(), or prompt(). Emptied in Task 4.
const PENDING_CONFIRM = new Set<string>([]);

// Non-global on purpose: a /g/ regex carries `lastIndex` between .test() calls
// and would silently skip every other file. The range is {3,8}, not {6}: hex
// colours are also written as 3-, 4-, and 8-digit (#fff, #f00, #aabbccdd), and
// a fixed {6} plus \b lets those slip through undetected.
const hasHex = (source: string) => /#[0-9a-fA-F]{3,8}\b/.test(source);

// Matches bare `confirm(`/`alert(`/`prompt(` as well as `window.`- or
// `globalThis.`-qualified calls — not just the `window.` form, which is rarer
// in practice than the unqualified one. The leading `(?:^|[^.\w$])` requires
// a non-identifier boundary before the keyword so property/variable names
// like `prompt.trim()`, `initialPrompt`, or `onConfirm` don't false-positive.
const hasNativeDialog = (source: string) =>
  /(?:^|[^.\w$])(?:window\.|globalThis\.)?(?:confirm|alert|prompt)\s*\(/.test(source);

function tsxFiles(): string[] {
  return readdirSync(SRC, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string" && entry.endsWith(".tsx"))
    .map((entry) => entry.replaceAll("\\", "/"));
}

const read = (file: string) => readFileSync(join(SRC, file), "utf8");

// A stale allow-list entry (its file deleted or renamed without updating the
// Set) must fail the ratchet test by naming that entry, not crash the whole
// suite with an uncaught ENOENT.
function readIfExists(file: string): string | null {
  try {
    return read(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

describe("design system drift guards", () => {
  test("no raw hex colours outside art components", () => {
    const offenders = tsxFiles()
      .filter(
        (file) => !ART_COMPONENTS.has(file) && !LITERAL_EXCEPTIONS.has(file) && !PENDING.has(file),
      )
      .filter((file) => hasHex(read(file)));
    expect(offenders).toEqual([]);
  });

  // The ratchet: once a PENDING file is cleaned, its entry must be deleted.
  // Without this, the allow-list would quietly grant permanent amnesty.
  test("every PENDING entry still actually contains a hex", () => {
    const stale = [...PENDING].filter((file) => {
      const source = readIfExists(file);
      return source === null || !hasHex(source);
    });
    expect(stale).toEqual([]);
  });

  test("no native confirm, alert, or prompt dialogs", () => {
    const offenders = tsxFiles()
      .filter((file) => !PENDING_CONFIRM.has(file))
      .filter((file) => hasNativeDialog(read(file)));
    expect(offenders).toEqual([]);
  });

  test("every PENDING_CONFIRM entry still actually uses a native dialog", () => {
    const stale = [...PENDING_CONFIRM].filter((file) => {
      const source = readIfExists(file);
      return source === null || !hasNativeDialog(source);
    });
    expect(stale).toEqual([]);
  });
});
