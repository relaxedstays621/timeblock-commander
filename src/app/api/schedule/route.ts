export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { scheduleDay, scheduleWeek, rescheduleFromNow } from '@/lib/scheduler';
import { selectTop3, detectOverload, analyzeCompanyBalance, calculateScore } from '@/lib/scoring';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { getCurrentUser } from '@/lib/auth';
import { clearBlocks } from '@/lib/blocks';
import type { TaskType } from '@prisma/client';

// POST /api/schedule
// body: { action: "day" | "week" | "reschedule", date?: string }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser({ includePreferences: true });
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const body = await req.json();
  const action = body.action || 'day';
  const date = body.date ? parseISO(body.date) : new Date();

  const prefs = (user as any).preferences;
  const config = {
    primeStart: prefs?.primeHoursStart ?? 8,
    primeEnd: prefs?.primeHoursEnd ?? 12,
    dayStart: 6,
    dayEnd: 20,
    breakMinutes: prefs?.breakMinutes ?? 15,
    maxDailyMinutes: (prefs?.maxDailyHours ?? 10) * 60,
    workDays: prefs?.workDays ?? [1, 2, 3, 4, 5],
  };

  // Get all active tasks
  const tasks = await prisma.task.findMany({
    where: {
      userId: user.id,
      status: { in: ['QUEUED', 'BACKLOG', 'SCHEDULED'] },
    },
  });

  // Get existing blocks
  const existingBlocks = await prisma.timeBlock.findMany({
    where: { userId: user.id },
  });

  let slots;

  if (action === 'reschedule') {
    const { keep, remove, add } = rescheduleFromNow(tasks, existingBlocks, config);

    // Delete removable blocks
    if (remove.length > 0) {
      await prisma.timeBlock.deleteMany({
        where: { id: { in: remove.map((b) => b.id) } },
      });
    }

    slots = add;
  } else if (action === 'week') {
    // Clear non-completed blocks for THIS week only, then schedule.
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });

    await clearBlocks(prisma, {
      userId: user.id,
      range: { gte: weekStart, lte: weekEnd },
    });

    // Pass surviving blocks (completed or outside this week) so the
    // scheduler respects them as occupied time.
    const survivingBlocks = await prisma.timeBlock.findMany({
      where: { userId: user.id },
    });

    slots = scheduleWeek(tasks, survivingBlocks, config, date);
  } else {
    // Clear non-completed blocks for the day, then schedule.
    const dateStr = format(date, 'yyyy-MM-dd');
    const targetDate = new Date(dateStr);

    await clearBlocks(prisma, {
      userId: user.id,
      range: targetDate,
    });

    // Pass surviving blocks (completed today, or any other day) so the
    // scheduler respects them as occupied time.
    const survivingBlocks = await prisma.timeBlock.findMany({
      where: { userId: user.id },
    });

    slots = scheduleDay(tasks, date, survivingBlocks, config);
  }

  // Create new blocks atomically with their task-status updates.
  // createManyAndReturn (Prisma 5.14+) lets us batch the insert and still
  // get back inserted rows. A unique-constraint failure on (userId, date,
  // startHour) aborts the whole transaction — no orphan blocks.
  const created = await prisma.$transaction(async (tx) => {
    if (slots.length === 0) return [];

    const blocks = await tx.timeBlock.createManyAndReturn({
      data: slots.map((slot) => ({
        date: new Date(slot.date),
        startHour: slot.startHour,
        durationMinutes: slot.durationMinutes,
        title: slot.title,
        company: slot.company,
        taskType: slot.taskType as TaskType | null,
        taskId: slot.taskId,
        userId: user.id,
      })),
    });

    const taskIds = slots.map((s) => s.taskId);
    if (taskIds.length > 0) {
      await tx.task.updateMany({
        where: { id: { in: taskIds }, userId: user.id },
        data: { status: 'SCHEDULED' },
      });
    }

    return blocks;
  });

  // Generate insights
  const allTasks = await prisma.task.findMany({ where: { userId: user.id } });
  const top3 = selectTop3(allTasks);
  const overload = detectOverload(allTasks);
  const balance = analyzeCompanyBalance(allTasks);

  return NextResponse.json({
    scheduled: created.length,
    blocks: created,
    insights: {
      top3: top3.map((t) => ({
        id: t.id,
        title: t.title,
        company: t.company,
        score: calculateScore(t),
      })),
      overload,
      companyBalance: balance,
    },
  });
}

// GET /api/schedule?date=YYYY-MM-DD — get blocks for a date
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');

  const blocks = await prisma.timeBlock.findMany({
    where: {
      userId: user.id,
      date: new Date(dateStr),
    },
    include: { task: true },
    orderBy: { startHour: 'asc' },
  });

  return NextResponse.json(blocks);
}
