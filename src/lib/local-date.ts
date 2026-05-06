/**
 * Returns the YYYY-MM-DD portion of `d` in the caller's local timezone.
 *
 * Centralizes the "today as the user sees it" pattern. `toISOString()` is
 * always UTC, which silently breaks comparisons against `block.date` (a
 * `@db.Date` column whose JSON form encodes the calendar date the row was
 * stored as). Use this for any client-side date-string derivation that needs
 * to match what the user calls "today".
 *
 * `'en-CA'` is the simplest locale that produces the ISO YYYY-MM-DD layout.
 */
export function toLocalDateString(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA');
}
