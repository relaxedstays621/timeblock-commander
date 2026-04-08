export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { UpdateTaskSchema } from '@/lib/schemas';
import { calculateScore } from '@/lib/scoring';

async function getUser() {
  return prisma.user.findFirst({ where: { email: 'owner@timeblock.local' } });
}

// GET /api/tasks/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
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
  const user = await getUser();
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

  // Handle completion
  const completionData: any = {};
  if (data.status === 'COMPLETE') {
    completionData.completedAt = new Date();
  }

  const task = await prisma.task.update({
    where: { id: params.id },
    data: {
      ...data,
      ...completionData,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    },
  });

  // Recalculate score
  const score = calculateScore(task);
  const updated = await prisma.task.update({
    where: { id: task.id },
    data: { compositeScore: score },
  });

  return NextResponse.json(updated);
}

// DELETE /api/tasks/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 401 });

  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ deleted: true });
}
