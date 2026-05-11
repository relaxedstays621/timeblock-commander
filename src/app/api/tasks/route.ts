export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CreateTaskSchema } from '@/lib/schemas';
import { calculateScore } from '@/lib/scoring';
import { getCurrentUser } from '@/lib/auth';
import { resolveTimezone } from '@/lib/timezone';
import { toLocalDateString } from '@/lib/local-date';
import { startOfWeek, endOfWeek } from 'date-fns';
import type { Task } from '@prisma/client';

// GET /api/tasks — list tasks with optional filters
//
// Each returned row is enriched with a derived `isScheduled` boolean:
// true when the task has at least one TimeBlock whose date falls inside
// the operator's local ISO this-week range (Monday–Sunday, weekStartsOn:1
// to match scoring.ts getCurrentWeek). The stored `task.status` is left
// untouched; "scheduled" is no longer a written status as of item 03
// of the daily-planning scope. Today is always inside this-week, so the
// "block today → scheduled regardless of week boundary" rule is
// implicitly satisfied by the range check.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser({ includePreferences: true });
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const company = searchParams.get('company');
  const carryover = searchParams.get('carryover');

  const where: any = { userId: user.id };
  if (status) where.status = status;
  if (company) where.company = company;
  if (carryover === 'true') where.carryover = true;

  const tasks = await prisma.task.findMany({
    where,
    orderBy: { compositeScore: 'desc' },
  });

  // Derive isScheduled per task. Two queries total: tasks above, then a
  // single block lookup keyed on the task ids we just fetched.
  const userTz = resolveTimezone((user as any).preferences);
  const now = new Date();
  // todayLocalDate is midnight-UTC of the operator's local calendar day —
  // the same anchor pattern used elsewhere with @db.Date columns.
  const todayLocalDate = new Date(toLocalDateString(now, userTz));
  const weekStart = startOfWeek(todayLocalDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(todayLocalDate, { weekStartsOn: 1 });

  let scheduledTaskIds = new Set<string>();
  if (tasks.length > 0) {
    const blocksInWeek = await prisma.timeBlock.findMany({
      where: {
        userId: user.id,
        taskId: { in: tasks.map((t) => t.id) },
        date: { gte: weekStart, lte: weekEnd },
      },
      select: { taskId: true },
    });
    scheduledTaskIds = new Set(
      blocksInWeek.map((b) => b.taskId).filter((id): id is string => Boolean(id)),
    );
  }

  const enriched = tasks.map((t) => ({ ...t, isScheduled: scheduledTaskIds.has(t.id) }));

  return NextResponse.json(enriched);
}

// POST /api/tasks — create a new task
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const body = await req.json();
  const parsed = CreateTaskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const dueDate = data.dueDate ? new Date(data.dueDate) : null;

  // Score depends only on validated input + defaults; compute it before
  // the insert so we don't need a follow-up update. `userPinned` must be
  // included or calculateScore can't short-circuit to 100 for pinned
  // captures, and the stored compositeScore would lag the runtime score
  // until the next PATCH triggers a recompute. `mustBeDoneToday` is
  // included for symmetry; today the field doesn't influence the score,
  // but item 05 may give it weight and the insert site should already
  // be feeding the full schema.
  const score = calculateScore({
    priority: data.priority,
    urgency: data.urgency,
    isStrategic: data.isStrategic,
    isReactive: data.isReactive,
    carryover: false,
    carryoverCount: 0,
    dueDate,
    userPinned: data.userPinned,
    mustBeDoneToday: data.mustBeDoneToday,
  } as Task);

  const task = await prisma.task.create({
    data: {
      ...data,
      dueDate,
      compositeScore: score,
      userId: user.id,
    },
  });

  return NextResponse.json(task, { status: 201 });
}
