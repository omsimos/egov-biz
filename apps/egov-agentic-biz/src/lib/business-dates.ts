// Dates on the business screens are filing deadlines, so they are read in the
// timezone the deadline is set in. Everything here pins to Asia/Manila rather
// than the device: a citizen in Dubai reading "due today" about a BIR return
// must get Manila's today, not theirs.
const MANILA = "Asia/Manila";

// Both shapes the API returns: a bare `YYYY-MM-DD` due date, and a full ISO
// timestamp for anything that was issued or created. The bare form is read as
// UTC midnight so it never slides a day under a negative offset.
function parse(value: string) {
  return new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
}

function format(value: string, options: Intl.DateTimeFormatOptions) {
  return parse(value).toLocaleDateString("en-PH", { timeZone: MANILA, ...options });
}

/** "Jul 30, 2026" */
export function formatBusinessDate(value: string) {
  return format(value, { day: "numeric", month: "short", year: "numeric" });
}

/** "Aug 10" — for a deadline near enough that the year is not the point. */
export function shortBusinessDate(value: string) {
  return format(value, { day: "numeric", month: "short" });
}

/** `{ day: "10", month: "Aug" }` — the two lines of a date tile. */
export function businessDateParts(value: string) {
  return {
    day: format(value, { day: "numeric" }),
    month: format(value, { month: "short" }),
  };
}

/**
 * Whole days from today to `value`, both taken as Manila calendar dates, so a
 * deadline later today is 0 rather than a fraction. Negative once it has passed.
 */
export function daysUntil(value: string, now = new Date()) {
  // en-CA is YYYY-MM-DD, which is the one locale format that round-trips
  // through Date.parse without ambiguity.
  const today = now.toLocaleDateString("en-CA", { timeZone: MANILA });
  const target = parse(value).toLocaleDateString("en-CA", { timeZone: MANILA });
  return Math.round((Date.parse(target) - Date.parse(today)) / 86_400_000);
}

/**
 * "in 11 days" / "today" / "tomorrow" / "11 days ago". Deliberately plain: this
 * sits beside the date itself, so it only has to say how far off it is.
 */
export function dueInLabel(value: string, now = new Date()) {
  const days = daysUntil(value, now);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}
