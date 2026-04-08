export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

async function getUser() {
  return prisma.user.findFirst({ where: { email: 'owner@timeblock.local' } });
}

// GET /api/blocks?range=day|week|month&date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const range = searchParams.get('range') || 'day';
  const dateStr = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');
  const date = new Date(dateStr);

  let start: Date, end: Date;

  switch (range) {
    case 'week':
      start = startOfWeek(date, { weekStartsOn: 1 });
      end = endOfWeek(date, { weekStartsOn: 1 });
      break;
    case 'month':
      start = startOfMonth(date);
      end = endOfMonth(date);
      break;
    default:
      start = new Date(dateStr);
      end = new Date(dateStr);
  }

  const blocks = await prisma.timeBlock.findMany({
    where: {
      userId: user.id,
      date: { gte: start, lte: end },
    },
    include: { task: true },
    orderBy: [{ date: 'asc' }, { startHour: 'asc' }],
  });

  return NextResponse.json(blocks);
}

// PATCH /api/blocks — mark a block complete
export async function PATCH(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const body = await req.json();
  const { id, completed, actualMinutes } = body;

  const block = await prisma.timeBlock.update({
    where: { id },
    data: { completed: completed ?? true },
  });

  // If block is linked to a task, update the task too
  if (block.taskId && completed) {
    await prisma.task.update({
      where: { id: block.taskId },
      data: {
        status: 'COMPLETE',
        completedAt: new Date(),
        actualMinutes: actualMinutes || block.durationMinutes,
      },
    });
  }

  return NextResponse.json(block);
}
