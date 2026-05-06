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

  // Wrap the entire pre-clear + plan + insert + status-update in one
  // interactive transaction so a failed insert (e.g. unique-constraint on
  // (userId, date, startHour)) rolls the clear back instead of leaving the
  // user with a wiped calendar and no replacement.
  const created = await prisma.$transaction(
    async (tx) => {
      let slots;

      if (action === 'reschedule') {
        const { remove, add } = rescheduleFromNow(tasks, existingBlocks, config);
        if (remove.length > 0) {
          await tx.timeBlock.deleteMany({
            where: { id: { in: remove.map((b) => b.id) } },
          });
        }
        slots = add;
      } else if (action === 'week') {
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(date, { weekStartsOn: 1 });

        await clearBlocks(tx, {
          userId: user.id,
          range: { gte: weekStart, lte: weekEnd },
        });

        // Survivors = blocks that remain after the clear (completed, or
        // outside this week). Re-query inside the tx so the scheduler sees
        // a consistent post-clear state.
        const survivingBlocks = await tx.timeBlock.findMany({
          where: { userId: user.id },
        });

        slots = scheduleWeek(tasks, survivingBlocks, config, date);
      } else {
        const dateStr = format(date, 'yyyy-MM-dd');
        const targetDate = new Date(dateStr);

        await clearBlocks(tx, {
          userId: user.id,
          range: targetDate,
        });

        const survivingBlocks = await tx.timeBlock.findMany({
          where: { userId: user.id },
        });

        slots = scheduleDay(tasks, date, survivingBlocks, config);
      }

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
    },
    // Scheduling can touch many rows; bump above the 5s default so a busy
    // user with a full week doesn't time out mid-tx.
    { timeout: 30_000 }
  );

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
