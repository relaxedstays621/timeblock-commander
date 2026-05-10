/**
 * Timezone helpers shared by calendar sync and any other code that needs
 * to convert between a user's wall-clock date/time and UTC instants.
 *
 * Implementation is std-library only (Intl.DateTimeFormat) so we don't pull
 * in date-fns-tz just for two functions.
 */

/**
 * Resolve the IANA timezone for a request. Prefers the user's stored
 * preference, falls back to the server's TZ env var, finally to UTC.
 */
export function resolveTimezone(
  prefs: { timezone?: string | null } | null | undefined
): string {
  return prefs?.timezone || process.env.TZ || 'UTC';
}

/**
 * Convert a wall-clock instant in `timeZone` (given as a YYYY-MM-DD plus a
 * "HH:MM:SS.mmm" time-of-day) to the corresponding UTC `Date`.
 *
 * Algorithm: assume the input is UTC, ask Intl how that UTC instant looks in
 * `timeZone`, take the resulting offset, and shift the input by it. Handles
 * DST correctly because Intl uses the actual zone rules.
 */
export function zonedWallClockToUTC(
  dateStr: string,
  timeOfDay: string,
  timeZone: string
): Date {
  const naive = new Date(`${dateStr}T${timeOfDay}Z`);

  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(naive)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }

  // en-US 24-hour formatting can render midnight as "24" — normalise.
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);

  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second)
  );

  return new Date(naive.getTime() - (asUTC - naive.getTime()));
}

/**
 * Returns a [start, end] pair of UTC `Date` objects representing the full
 * calendar day `dateStr` (YYYY-MM-DD) in `timeZone`. Used to scope Google
 * Calendar event queries to the day the user actually means.
 */
export function zonedDayBoundsToUTC(
  dateStr: string,
  timeZone: string
): { start: Date; end: Date } {
  return {
    start: zonedWallClockToUTC(dateStr, '00:00:00.000', timeZone),
    end: zonedWallClockToUTC(dateStr, '23:59:59.999', timeZone),
  };
}

/**
 * Hour-of-day (0..23) of `d` as observed in `timeZone`. Use this when you
 * need to compare a block's `startHour` against the current wall-clock hour
 * in the user's zone — `Date.getHours()` would return the runtime's hour,
 * which only happens to match the user's hour while there's a single user
 * whose TZ matches the container's TZ env.
 *
 * `'en-CA'` formats hours in 24h layout; `hour12: false` reinforces it. The
 * `% 24` guards against the rare locale that renders midnight as "24".
 */
export function zonedHour(d: Date, timeZone: string): number {
  const hh = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  }).format(d);
  return parseInt(hh, 10) % 24;
}

/**
 * Minute-of-hour (0..59) of `d` as observed in `timeZone`. Pairs with
 * `zonedHour` for :15-grid comparisons against a block's
 * `(startHour, startMinute)`.
 */
export function zonedMinute(d: Date, timeZone: string): number {
  const mm = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return parseInt(mm, 10) % 60;
}
