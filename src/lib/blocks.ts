import { prisma } from './db';
import type { Prisma, PrismaClient } from '@prisma/client';
import { gridSlotsForDuration } from './scheduler';

const SLOT_MIN = 15;
const SLOTS_PER_HOUR = 60 / SLOT_MIN; // 4
// End of the visible/schedulable day. Matches scheduler.DEFAULT_CONFIG.dayEnd
// and TodayView's dayEndSlot (21 * 4). Blocks whose cascade would end past
// this slot are unscheduled.
const DEFAULT_DAY_END_HOUR = 21;

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

// ─────────────────────────────────────────────────────────
// MOVE WITH CASCADE (item 07)
// ─────────────────────────────────────────────────────────

interface CascadeBlock {
  id: string;
  startHour: number;
  startMinute: number;
  durationMinutes: number;
  taskId: string | null;
}

export interface CascadePlanInput {
  movedId: string;
  newStartSlot: number;
  blocks: CascadeBlock[];
  dayEndSlot: number;
}

export interface CascadePlanResult {
  placed: { id: string; startSlot: number; durationSlots: number }[];
  unscheduled: { id: string; taskId: string | null }[];
}

/**
 * Pure cascade planner. Given the day's existing blocks and a target slot
 * for `movedId`, compute final positions for every block on the day.
 *
 * Semantics:
 *
 * - The moved block lands at `newStartSlot` as the operator requested. If
 *   that would push its end past `dayEndSlot`, the moved block itself
 *   becomes unscheduled (caller can decide whether to surface that as a
 *   user-visible "doesn't fit" or to commit it).
 * - Every other block tries to keep its original start. If its original
 *   range overlaps anything already placed (which may be the moved block
 *   or an earlier-cascaded block), it slides forward to the first slot
 *   after the conflict. Sliding can re-conflict with the next placed
 *   block, so the search loops until no overlap remains.
 * - Other blocks are processed in original-start ascending order, which
 *   preserves their original temporal order among themselves. The moved
 *   block can land anywhere — its order relative to others reflects the
 *   operator's intent.
 * - "Preserve relative gaps where possible" is honored when no push is
 *   needed (a block with no conflict keeps its slot exactly). When a push
 *   is forced, the block slides only as far as required, which can
 *   collapse a previously-existing gap. This is the simpler interpretation
 *   of the "where possible" qualifier from checklist 07.
 * - A block whose final position would end past `dayEndSlot` is marked
 *   unscheduled. Callers delete its row and revert any SCHEDULED /
 *   IN_PROGRESS task back to QUEUED.
 *
 * `gridSlotsForDuration` is reused from the scheduler so a <=15-min block
 * still reserves 30 minutes of grid space — identical occupancy rules in
 * both auto-placement and manual cascade.
 */
export function planCascade(input: CascadePlanInput): CascadePlanResult {
  const moved = input.blocks.find((b) => b.id === input.movedId);
  if (!moved) {
    throw new Error(`planCascade: movedId ${input.movedId} not in blocks list`);
  }

  const movedDurSlots = gridSlotsForDuration(moved.durationMinutes);
  const placed: CascadePlanResult['placed'] = [];
  const unscheduled: CascadePlanResult['unscheduled'] = [];

  if (input.newStartSlot + movedDurSlots > input.dayEndSlot) {
    unscheduled.push({ id: moved.id, taskId: moved.taskId });
  } else {
    placed.push({
      id: moved.id,
      startSlot: input.newStartSlot,
      durationSlots: movedDurSlots,
    });
  }

  const others = input.blocks
    .filter((b) => b.id !== input.movedId)
    .map((b) => ({
      id: b.id,
      taskId: b.taskId,
      origStartSlot: b.startHour * SLOTS_PER_HOUR + Math.floor(b.startMinute / SLOT_MIN),
      durSlots: gridSlotsForDuration(b.durationMinutes),
    }))
    .sort((a, b) => a.origStartSlot - b.origStartSlot);

  for (const block of others) {
    let candidate = block.origStartSlot;
    // Loop until no overlap with any placed block. Each push lands on the
    // far edge of a conflict, so the loop is bounded by the number of
    // already-placed blocks (worst case O(n^2)).
    let conflict = true;
    while (conflict) {
      conflict = false;
      for (const p of placed) {
        if (candidate < p.startSlot + p.durationSlots && candidate + block.durSlots > p.startSlot) {
          candidate = p.startSlot + p.durationSlots;
          conflict = true;
          break;
        }
      }
    }
    if (candidate + block.durSlots > input.dayEndSlot) {
      unscheduled.push({ id: block.id, taskId: block.taskId });
    } else {
      placed.push({ id: block.id, startSlot: candidate, durationSlots: block.durSlots });
    }
  }

  return { placed, unscheduled };
}

export interface MoveBlockArgs {
  userId: string;
  blockId: string;
  newStartHour: number;
  newStartMinute: number;
  /** Override the visible-day end (in hour units). Defaults to 21 (9pm). */
  dayEndHour?: number;
}

export interface MoveBlockResult {
  moved: { id: string; startHour: number; startMinute: number };
  cascaded: { id: string; startHour: number; startMinute: number }[];
  unscheduled: { id: string; taskId: string | null }[];
}

/**
 * Apply a block move with cascade in a single Prisma transaction.
 *
 * Ownership is enforced on the moved block; the same-day block list is
 * always scoped to the same userId.
 *
 * The update order matters: Postgres checks unique constraints
 * `(userId, date, startHour, startMinute)` per statement, so we sort
 * UPDATEs in reverse-new-slot order. Each statement writes a slot that
 * has just been vacated by a later-in-the-iteration update, so there's
 * no transient collision. Unscheduled blocks are deleted before the
 * UPDATEs so their old slots are free first.
 *
 * Tasks attached to unscheduled blocks are reverted from SCHEDULED /
 * IN_PROGRESS to QUEUED — mirrors the pattern in `clearBlocks`.
 *
 * Throws when the moved block itself can't fit (its requested end is past
 * `dayEndHour * 4`). Callers should surface that as a user-facing error
 * rather than committing the half-state.
 */
export async function moveBlockWithCascade(
  db: PrismaClient,
  args: MoveBlockArgs,
): Promise<MoveBlockResult> {
  const dayEndSlot = (args.dayEndHour ?? DEFAULT_DAY_END_HOUR) * SLOTS_PER_HOUR;

  // Snap inputs defensively. Callers should snap, but a bad client write
  // should not corrupt slot math.
  const snappedHour = Math.max(0, Math.min(23, Math.floor(args.newStartHour)));
  const snappedMinute = Math.floor(args.newStartMinute / SLOT_MIN) * SLOT_MIN;
  const newStartSlot = snappedHour * SLOTS_PER_HOUR + Math.floor(snappedMinute / SLOT_MIN);

  const moved = await db.timeBlock.findFirst({
    where: { id: args.blockId, userId: args.userId },
  });
  if (!moved) {
    throw new Error('Block not found');
  }

  const sameDayBlocks = await db.timeBlock.findMany({
    where: { userId: args.userId, date: moved.date },
    select: { id: true, startHour: true, startMinute: true, durationMinutes: true, taskId: true },
  });

  const plan = planCascade({
    movedId: args.blockId,
    newStartSlot,
    blocks: sameDayBlocks,
    dayEndSlot,
  });

  if (plan.unscheduled.some((u) => u.id === args.blockId)) {
    throw new Error('Move would push the block past end-of-day');
  }

  // Map current slot → block, so we can diff updates and avoid touching
  // rows whose slot doesn't change.
  const currentSlot = new Map<string, number>(
    sameDayBlocks.map((b) => [
      b.id,
      b.startHour * SLOTS_PER_HOUR + Math.floor(b.startMinute / SLOT_MIN),
    ]),
  );

  const updates = plan.placed
    .filter((p) => currentSlot.get(p.id) !== p.startSlot)
    .sort((a, b) => b.startSlot - a.startSlot); // reverse new-slot order

  const unscheduledIds = plan.unscheduled.map((u) => u.id);
  const unscheduledTaskIds = plan.unscheduled
    .map((u) => u.taskId)
    .filter((id): id is string => Boolean(id));

  await db.$transaction(async (tx) => {
    if (unscheduledIds.length > 0) {
      await tx.timeBlock.deleteMany({ where: { id: { in: unscheduledIds } } });
    }
    for (const u of updates) {
      const newHour = Math.floor(u.startSlot / SLOTS_PER_HOUR);
      const newMinute = (u.startSlot % SLOTS_PER_HOUR) * SLOT_MIN;
      await tx.timeBlock.update({
        where: { id: u.id },
        data: { startHour: newHour, startMinute: newMinute },
      });
    }
    if (unscheduledTaskIds.length > 0) {
      await tx.task.updateMany({
        where: {
          id: { in: unscheduledTaskIds },
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
        },
        data: { status: 'QUEUED' },
      });
    }
  });

  const movedFinal = plan.placed.find((p) => p.id === args.blockId)!;
  const cascadedChanges = plan.placed
    .filter((p) => p.id !== args.blockId && currentSlot.get(p.id) !== p.startSlot)
    .map((p) => ({
      id: p.id,
      startHour: Math.floor(p.startSlot / SLOTS_PER_HOUR),
      startMinute: (p.startSlot % SLOTS_PER_HOUR) * SLOT_MIN,
    }));

  return {
    moved: {
      id: args.blockId,
      startHour: Math.floor(movedFinal.startSlot / SLOTS_PER_HOUR),
      startMinute: (movedFinal.startSlot % SLOTS_PER_HOUR) * SLOT_MIN,
    },
    cascaded: cascadedChanges,
    unscheduled: plan.unscheduled,
  };
}
