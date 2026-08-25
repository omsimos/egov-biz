import type { PDFFont } from "pdf-lib";

/** Characters the WinAnsi standard fonts cannot encode, keyed to their printable stand-in. */
const STANDARD_FONT_REPLACEMENTS = new Map([
  [" ", " "],
  ["–", "-"],
  ["—", "-"],
  ["‘", "'"],
  ["’", "'"],
  ["“", '"'],
  ["”", '"'],
  ["…", "..."],
  ["₱", "PHP "],
]);

export function standardFontText(font: PDFFont, value: string) {
  let result = "";
  for (const character of value.normalize("NFC")) {
    const replacement = STANDARD_FONT_REPLACEMENTS.get(character) ?? character;
    for (const candidate of replacement) {
      try {
        font.encodeText(candidate);
        result += candidate;
      } catch {
        const codePoint = candidate.codePointAt(0)?.toString(16).toUpperCase();
        throw new Error(
          `The BIR PDF template cannot render Unicode character U+${codePoint ?? "UNKNOWN"}`,
        );
      }
    }
  }
  return result;
}
