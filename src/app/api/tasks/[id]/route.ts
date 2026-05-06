export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { UpdateTaskSchema } from '@/lib/schemas';
import { calculateScore } from '@/lib/scoring';
import { getCurrentUser } from '@/lib/auth';

// GET /api/tasks/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const task = await prisma.task.findFirst({
    where: { id: params.id, userId: user.id },
    include: { blocks: true },
  });

  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(task);
}

// PATCH /api/tasks/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const body = await req.json();
  const parsed = UpdateTaskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Ownership check — refuse to mutate another user's task.
  const existing = await prisma.task.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Handle status transitions around completion.
  const completionData: { completedAt?: Date | null } = {};
  if (data.status !== undefined) {
    if (data.status === 'COMPLETE') {
      completionData.completedAt = new Date();
    } else if (existing.status === 'COMPLETE') {
      // Reopening: clear completedAt so it doesn't keep a stale timestamp.
      completionData.completedAt = null;
    }
  }

  // dueDate: undefined = leave alone, null = clear, string = set.
  const dueDate =
    data.dueDate === undefined ? undefined : data.dueDate === null ? null : new Date(data.dueDate);

  // Compute the post-update task in memory so we can score and write in one go.
  const merged = {
    ...existing,
    ...data,
    ...completionData,
    dueDate: dueDate === undefined ? existing.dueDate : dueDate,
  } as typeof existing;
  const score = calculateScore(merged);

  const updated = await prisma.task.update({
    where: { id: existing.id },
    data: {
      ...data,
      ...completionData,
      dueDate,
      compositeScore: score,
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/tasks/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const result = await prisma.task.deleteMany({
    where: { id: params.id, userId: user.id },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
