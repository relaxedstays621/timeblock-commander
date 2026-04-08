export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CreateTaskSchema, UpdateTaskSchema } from '@/lib/schemas';
import { calculateScore } from '@/lib/scoring';
import { getCurrentUser } from '@/lib/auth';

// GET /api/tasks — list tasks with optional filters
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
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

  return NextResponse.json(tasks);
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

  // Create task
  const task = await prisma.task.create({
    data: {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      userId: user.id,
    },
  });

  // Calculate and store composite score
  const score = calculateScore(task);
  const updated = await prisma.task.update({
    where: { id: task.id },
    data: { compositeScore: score },
  });

  return NextResponse.json(updated, { status: 201 });
}
