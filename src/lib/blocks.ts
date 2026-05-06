import { prisma } from './db';
import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Subset of the Prisma client we actually need. Accepts either the global
 * `prisma` or a transaction client (`tx` inside `$transaction`).
 */
type DbClient = PrismaClient | Prisma.TransactionClient;

export interface ClearBlocksOptions {
  userId: string;
  /** A single date matches blocks on that day; a range matches gte/lte. */
  range: Date | { gte: Date; lte: Date };
  /** When true (default), only non-completed blocks are deleted. */
  onlyIncomplete?: boolean;
}

export interface ClearBlocksResult {
  cleared: number;
  resetCount: number;
}

/**
 * Delete blocks in the given range for a user, then reset any tasks that
 * those blocks were linked to back to QUEUED — but only if the task is
 * SCHEDULED or IN_PROGRESS (we don't reopen COMPLETED or DROPPED tasks).
 *
 * Centralizes the "clear time blocks and reset their tasks" pattern that
 * previously lived in three near-duplicate copies across the API routes.
 */
export async function clearBlocks(
  db: DbClient,
  { userId, range, onlyIncomplete = true }: ClearBlocksOptions,
): Promise<ClearBlocksResult> {
  const where = {
    userId,
    ...(onlyIncomplete ? { completed: false } : {}),
    date: range,
  };

  const blocks = await db.timeBlock.findMany({ where, select: { taskId: true } });
  const taskIds = blocks
    .map((b) => b.taskId)
    .filter((id): id is string => Boolean(id));

  const deleted = await db.timeBlock.deleteMany({ where });

  if (taskIds.length > 0) {
    await db.task.updateMany({
      where: { id: { in: taskIds }, status: { in: ['SCHEDULED', 'IN_PROGRESS'] } },
      data: { status: 'QUEUED' },
    });
  }

  return { cleared: deleted.count, resetCount: taskIds.length };
}
