export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { moveBlockWithCascade } from '@/lib/blocks';

// PUT /api/blocks/[id]
// Body: { startHour: 0..23, startMinute: 0|15|30|45 }
//
// Moves the block to the new :15-aligned slot and cascades any blocks
// whose original slots overlap. Blocks pushed past end-of-day (9pm) are
// deleted and their tasks reverted to QUEUED (see moveBlockWithCascade
// in src/lib/blocks.ts). Calendar sync is not triggered here — the
// gcalEventId stays attached and is reconciled on the next explicit
// calendar push, so a single drop never produces a Google Calendar write.
const MoveBodySchema = z.object({
  startHour: z.number().int().min(0).max(23),
  startMinute: z
    .number()
    .int()
    .refine((m) => m === 0 || m === 15 || m === 30 || m === 45, {
      message: 'startMinute must be 0, 15, 30, or 45',
    }),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = MoveBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await moveBlockWithCascade(prisma, {
      userId: user.id,
      blockId: params.id,
      newStartHour: parsed.data.startHour,
      newStartMinute: parsed.data.startMinute,
    });
    return NextResponse.json(result);
  } catch (e: any) {
    const message = e?.message ?? 'Move failed';
    // Ownership / not-found case
    if (message === 'Block not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    // The moved block would itself overflow the visible day — operator
    // dropped at a slot that can't hold the block's duration.
    if (message === 'Move would push the block past end-of-day') {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
