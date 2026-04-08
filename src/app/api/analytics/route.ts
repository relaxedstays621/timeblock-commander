import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { analyzeCompanyBalance, detectOverload, selectTop3, calculateScore } from '@/lib/scoring';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

async function getUser() {
  return prisma.user.findFirst({ where: { email: 'owner@timeblock.local' } });
}

// GET /api/analytics?range=week|month
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const range = searchParams.get('range') || 'week';
  const now = new Date();

  let start: Date, end: Date;
  if (range === 'month') {
    start = startOfMonth(now);
    end = endOfMonth(now);
  } else {
    start = startOfWeek(now, { weekStartsOn: 1 });
    end = endOfWeek(now, { weekStartsOn: 1 });
  }

  // All tasks
  const tasks = await prisma.task.findMany({
    where: { userId: user.id },
  });

  // Blocks in range
  const blocks = await prisma.timeBlock.findMany({
    where: {
      userId: user.id,
      date: { gte: start, lte: end },
    },
  });

  // By company
  const byCompany: Record<string, { planned: number; completed: number; count: number }> = {};
  for (const company of ['APERTURE_ADS', 'RENTALS', 'DIYP', 'PERSONAL']) {
    const compBlocks = blocks.filter((b) => b.company === company);
    byCompany[company] = {
      planned: compBlocks.reduce((sum, b) => sum + b.durationMinutes, 0),
      completed: compBlocks.filter((b) => b.completed).reduce((sum, b) => sum + b.durationMinutes, 0),
      count: compBlocks.length,
    };
  }

  // By type
  const byType: Record<string, { planned: number; completed: number }> = {};
  for (const type of ['PROMOTION', 'DELIVERING', 'BUILDING']) {
    const typeBlocks = blocks.filter((b) => b.taskType === type);
    byType[type] = {
      planned: typeBlocks.reduce((sum, b) => sum + b.durationMinutes, 0),
      completed: typeBlocks.filter((b) => b.completed).reduce((sum, b) => sum + b.durationMinutes, 0),
    };
  }

  // Totals
  const totalPlanned = blocks.reduce((sum, b) => sum + b.durationMinutes, 0);
  const totalCompleted = blocks.filter((b) => b.completed).reduce((sum, b) => sum + b.durationMinutes, 0);

  // Strategic vs reactive
  const strategic = tasks.filter((t) => t.isStrategic).length;
  const reactive = tasks.filter((t) => t.isReactive).length;
  const carryovers = tasks.filter((t) => t.carryover).length;

  // Insights
  const top3 = selectTop3(tasks).map((t) => ({
    id: t.id,
    title: t.title,
    company: t.company,
    score: calculateScore(t),
  }));
  const overload = detectOverload(tasks);
  const balance = analyzeCompanyBalance(tasks);

  return NextResponse.json({
    range,
    period: { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') },
    byCompany,
    byType,
    totals: {
      planned: totalPlanned,
      completed: totalCompleted,
      tasksTotal: tasks.length,
      tasksComplete: tasks.filter((t) => t.status === 'COMPLETE').length,
    },
    composition: { strategic, reactive, carryovers },
    insights: { top3, overload, balance },
  });
}
