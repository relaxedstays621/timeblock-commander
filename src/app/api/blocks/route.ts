export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { getCurrentUser } from '@/lib/auth';

// GET /api/blocks?range=day|week|month&date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
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
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const body = await req.json();
  const { id, completed, actualMinutes } = body;

  // Ownership check — refuse to mutate another user's block.
  const existing = await prisma.timeBlock.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const block = await prisma.timeBlock.update({
    where: { id: existing.id },
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

// DELETE /api/blocks?date=YYYY-MM-DD — clear that day's non-completed blocks.
// The date must come from the client (which knows its local timezone) so a
// late-evening click clears the user's local "today", not the server's.
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get('date');
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json(
      { error: 'date query parameter is required (YYYY-MM-DD)' },
      { status: 400 }
    );
  }
  const targetDate = new Date(dateStr);

  // Get blocks to find task IDs
  const blocks = await prisma.timeBlock.findMany({
    where: { userId: user.id, completed: false, date: targetDate },
  });

  const taskIds = blocks.filter(b => b.taskId).map(b => b.taskId) as string[];

  // Delete blocks
  const deleted = await prisma.timeBlock.deleteMany({
    where: { userId: user.id, completed: false, date: targetDate },
  });

  // Reset task statuses
  if (taskIds.length > 0) {
    await prisma.task.updateMany({
      where: { id: { in: taskIds }, status: { in: ['SCHEDULED', 'IN_PROGRESS'] } },
      data: { status: 'QUEUED' },
    });
  }

  return NextResponse.json({ cleared: deleted.count });
}
