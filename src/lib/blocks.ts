import { prisma } from './db';
import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Subset of the Prisma client we actually need. Accepts either the global
 * `prisma` or a transaction client (`tx` inside `$transaction`).
 */
type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Prisma `where` shape that matches a *live* TimeBlock — one that has not
 * been completed AND whose start has not yet elapsed. Used to express
 * "task has no live blocks" via Prisma's relation `none` filter:
 *
 *   blocks: { none: liveBlockFilter(todayStart, currentHour, currentMinute) }
 *
 * :15-grid granularity: a block dated *today* whose
 * `(startHour, startMinute) <= (currentHour, currentMinute)` has elapsed and
 * is no longer live. The minute axis matters once blocks can land on :15,
 * :30, or :45; without it a 9:45 block at 9:30 would be treated as past.
 *
 * Inputs:
 *   - `todayStart`: midnight UTC of the user's local calendar day, derived
 *     from `toLocalDateString(now, resolveTimezone(prefs))`.
 *   - `currentHour`: 0..23, derived from `zonedHour(now, ...)`.
 *   - `currentMinute`: 0..59, derived from `zonedMinute(now, ...)`.
 *
 * Live ⇔ (date strictly after today)
 *      OR (date == today AND startHour strictly after currentHour)
 *      OR (date == today AND startHour == currentHour AND startMinute
 *          strictly after currentMinute).
 * Blocks for the current :15 slot are treated as past, matching the
 * convention in `rescheduleFromNow`.
 */
export function liveBlockFilter(
  todayStart: Date,
  currentHour: number,
  currentMinute: number,
): Prisma.TimeBlockWhereInput {
  return {
    completed: false,
    OR: [
      { date: { gt: todayStart } },
      { date: todayStart, startHour: { gt: currentHour } },
      { date: todayStart, startHour: currentHour, startMinute: { gt: currentMinute } },
    ],
  };
}

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
