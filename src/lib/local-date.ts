/**
 * Returns the YYYY-MM-DD portion of `d` in a target timezone.
 *
 * - When `timeZone` is omitted (the typical browser case), uses the runtime's
 *   local zone — what the user sees on their wall clock.
 * - When `timeZone` is supplied (the typical server case), formats in that
 *   IANA zone instead. Pair with `resolveTimezone()` from `src/lib/timezone`
 *   to derive the user's preferred zone from `UserPreferences`.
 *
 * Centralizes the "today as the user sees it" pattern. `toISOString()` is
 * always UTC, which silently breaks comparisons against `block.date` (a
 * `@db.Date` column whose JSON form encodes the calendar date the row was
 * stored as).
 *
 * `'en-CA'` is the simplest locale that produces the ISO YYYY-MM-DD layout.
 */
export function toLocalDateString(d: Date = new Date(), timeZone?: string): string {
  return d.toLocaleDateString('en-CA', timeZone ? { timeZone } : undefined);
}
