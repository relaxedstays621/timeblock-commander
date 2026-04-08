import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import {
  listCalendars,
  createEvent,
  updateEvent,
} from '@/lib/google-calendar';
import { format, startOfDay, endOfDay } from 'date-fns';
import type { Company } from '@prisma/client';
import type { calendar_v3 } from 'googleapis';

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

// GET /api/calendar — list the signed-in user's Google calendars
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 401 });

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

  const prefs = (user as any).preferences as Parameters<typeof calendarIdForCompany>[1];

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

  for (const block of blocks) {
    const calendarId = calendarIdForCompany(block.company, prefs);

    // Construct start/end from block.date + startHour + durationMinutes.
    // block.date is stored as a DATE, so we build the local wall-clock time.
    const start = new Date(block.date);
    start.setHours(block.startHour, 0, 0, 0);
    const end = new Date(start.getTime() + block.durationMinutes * 60_000);

    const event: calendar_v3.Schema$Event = {
      summary: block.title,
      description: `TimeBlock Commander — ${block.company}${
        block.taskType ? ` / ${block.taskType}` : ''
      }`,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
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
