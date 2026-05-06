import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import {
  listCalendars,
  createEvent,
  updateEvent,
} from '@/lib/google-calendar';
import { format, startOfDay, endOfDay } from 'date-fns';
import { resolveTimezone, zonedDayBoundsToUTC } from '@/lib/timezone';
import type { Company } from '@prisma/client';
import type { calendar_v3 } from 'googleapis';

/**
 * Format a stored block as a Google Calendar wall-clock event in the user's
 * timezone. block.date is a DATE (midnight UTC); we extract its UTC y/m/d to
 * recover the calendar date the user intended, then build "YYYY-MM-DDTHH:MM:00"
 * and let Google interpret it under `timeZone`.
 */
function buildEventTimes(
  block: { date: Date; startHour: number; durationMinutes: number },
  timeZone: string
): { start: calendar_v3.Schema$EventDateTime; end: calendar_v3.Schema$EventDateTime } {
  const y = block.date.getUTCFullYear();
  const m = String(block.date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(block.date.getUTCDate()).padStart(2, '0');
  const startHH = String(block.startHour).padStart(2, '0');

  // Compute end as start + duration, rolling over hours within the day. We
  // build a Date in UTC just to do arithmetic, then re-format the components.
  const startTotalMin = block.startHour * 60;
  const endTotalMin = startTotalMin + block.durationMinutes;
  const endHour = Math.floor(endTotalMin / 60);
  const endMin = endTotalMin % 60;

  // If duration spills past 24:00 we'd need to advance the date — clamp to
  // 23:59 so we never silently produce an event on the wrong day.
  const safeEndHour = Math.min(endHour, 23);
  const safeEndMin = endHour > 23 ? 59 : endMin;

  const startStr = `${y}-${m}-${d}T${startHH}:00:00`;
  const endStr = `${y}-${m}-${d}T${String(safeEndHour).padStart(2, '0')}:${String(safeEndMin).padStart(2, '0')}:00`;

  return {
    start: { dateTime: startStr, timeZone },
    end: { dateTime: endStr, timeZone },
  };
}

/**
 * Returns the calendar ID to use for a given company, based on the user's
 * preferences. Falls back to the Google "primary" calendar.
 */
function calendarIdForCompany(
  company: Company,
  prefs: {
    calendarAperture: string | null;
    calendarRentals: string | null;
    calendarDiyp: string | null;
    calendarPersonal: string | null;
  } | null
): string {
  if (!prefs) return 'primary';
  switch (company) {
    case 'APERTURE_ADS':
      return prefs.calendarAperture || 'primary';
    case 'RENTALS':
      return prefs.calendarRentals || 'primary';
    case 'DIYP':
      return prefs.calendarDiyp || 'primary';
    case 'PERSONAL':
      return prefs.calendarPersonal || 'primary';
    default:
      return 'primary';
  }
}

// GET /api/calendar — list calendars or fetch events
export async function GET(req: NextRequest) {
  const user = await getCurrentUser({ includePreferences: true });
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const dateStr = searchParams.get('date');

  if (action === 'events' && dateStr) {
    try {
      const prefs = (user as any).preferences;
      const calIds = [
        prefs?.calendarAperture,
        prefs?.calendarRentals,
        prefs?.calendarDiyp,
        prefs?.calendarPersonal,
      ].filter(Boolean).flatMap((id: string) => id.split(','));

      // Scope the day window to the user's IANA timezone so the events
      // returned match the calendar day the user clicked on (matches what
      // POST sync does with stored blocks).
      const tz = resolveTimezone(prefs);
      const { start: dayStart, end: dayEnd } = zonedDayBoundsToUTC(dateStr, tz);

      const { listEvents } = await import('@/lib/google-calendar');
      const allEvents: any[] = [];

      for (const calId of calIds) {
        try {
          const events = await listEvents(user.id, calId.trim(), dayStart, dayEnd);
          allEvents.push(...(events || []));
        } catch (e) {
          // Skip calendars that fail
        }
      }

      // Sort by start time
      allEvents.sort((a, b) => {
        const aStart = new Date(a.start?.dateTime || a.start?.date || 0);
        const bStart = new Date(b.start?.dateTime || b.start?.date || 0);
        return aStart.getTime() - bStart.getTime();
      });

      return NextResponse.json(allEvents);
    } catch (err: any) {
      return NextResponse.json(
        { error: err?.message ?? 'Failed to fetch events' },
        { status: 500 }
      );
    }
  }

  try {
    const calendars = await listCalendars(user.id);
    return NextResponse.json(calendars);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Failed to list calendars' },
      { status: 500 }
    );
  }
}

// POST /api/calendar — sync today's time blocks to Google Calendar
export async function POST(req: NextRequest) {
  const user = await getCurrentUser({ includePreferences: true });
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 401 });

  // Allow callers to override the date; default to today.
  const body = await req.json().catch(() => ({}));
  const date = body?.date ? new Date(body.date) : new Date();
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const prefs = (user as any).preferences as
    | (Parameters<typeof calendarIdForCompany>[1] & { timezone?: string | null })
    | null;

  const blocks = await prisma.timeBlock.findMany({
    where: {
      userId: user.id,
      date: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { startHour: 'asc' },
  });

  const results: Array<{
    blockId: string;
    action: 'created' | 'updated' | 'error';
    eventId?: string;
    error?: string;
  }> = [];

  const timeZone = resolveTimezone(prefs);

  for (const block of blocks) {
    const calendarId = calendarIdForCompany(block.company, prefs);

    // Build start/end as wall-clock times in the user's timezone so a
    // 10:00 block becomes 10:00 in their TZ regardless of server TZ.
    const { start, end } = buildEventTimes(block, timeZone);

    const event: calendar_v3.Schema$Event = {
      summary: block.title,
      description: `TimeBlock Commander — ${block.company}${
        block.taskType ? ` / ${block.taskType}` : ''
      }`,
      start,
      end,
    };

    try {
      if (block.gcalEventId) {
        const updated = await updateEvent(user.id, calendarId, block.gcalEventId, event);
        results.push({
          blockId: block.id,
          action: 'updated',
          eventId: updated.id ?? undefined,
        });
      } else {
        const created = await createEvent(user.id, calendarId, event);
        if (created.id) {
          await prisma.timeBlock.update({
            where: { id: block.id },
            data: { gcalEventId: created.id },
          });
        }
        results.push({
          blockId: block.id,
          action: 'created',
          eventId: created.id ?? undefined,
        });
      }
    } catch (err: any) {
      results.push({
        blockId: block.id,
        action: 'error',
        error: err?.message ?? 'Unknown error',
      });
    }
  }

  return NextResponse.json({
    date: format(date, 'yyyy-MM-dd'),
    synced: results.filter((r) => r.action !== 'error').length,
    errors: results.filter((r) => r.action === 'error').length,
    results,
  });
}
