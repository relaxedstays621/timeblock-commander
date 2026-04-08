export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { scheduleDay, scheduleWeek, rescheduleFromNow } from '@/lib/scheduler';
import { selectTop3, detectOverload, analyzeCompanyBalance, calculateScore } from '@/lib/scoring';
import { format, parseISO } from 'date-fns';
import { getCurrentUser } from '@/lib/auth';

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
      status: { in: ['QUEUED', 'BACKLOG'] },
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
    // Clear future non-completed blocks for the week
    await prisma.timeBlock.deleteMany({
      where: {
        userId: user.id,
        completed: false,
        date: { gte: date },
      },
    });

    slots = scheduleWeek(tasks, [], config, date);
  } else {
    // Clear non-completed blocks for the day
    const dateStr = format(date, 'yyyy-MM-dd');
    await prisma.timeBlock.deleteMany({
      where: {
        userId: user.id,
        completed: false,
        date: new Date(dateStr),
      },
    });

    slots = scheduleDay(tasks, date, [], config);
  }

  // Create new blocks
  const created = [];
  for (const slot of slots) {
    const block = await prisma.timeBlock.create({
      data: {
        date: new Date(slot.date),
        startHour: slot.startHour,
        durationMinutes: slot.durationMinutes,
        title: slot.title,
        company: slot.company,
        taskType: slot.taskType as any,
        taskId: slot.taskId,
        userId: user.id,
      },
    });
    created.push(block);

    // Update task status to SCHEDULED
    await prisma.task.update({
      where: { id: slot.taskId },
      data: { status: 'SCHEDULED' },
    });
  }

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
