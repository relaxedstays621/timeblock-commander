import { Task, TimeBlock, Company, TaskStatus } from '@prisma/client';
import { calculateScore, selectTop3 } from './scoring';
import { format, addDays, startOfWeek, startOfDay } from 'date-fns';

// All scheduling math operates on a fixed :15 grid. Hours-only configs are
// translated into slot indices internally (slot index = minute-of-day / 15).
const SLOT_MIN = 15;
const SLOTS_PER_HOUR = 60 / SLOT_MIN; // 4

/**
 * Grid slots that a block with this many minutes occupies. A block of 15
 * minutes or less reserves 30 minutes (2 slots) of grid space — visual
 * breathing room for tiny tasks and the rule the scope locks in. The
 * duration value stored in the DB stays truthful; this affects only
 * occupancy and placement math.
 *
 * Used symmetrically when building the occupied set from existing blocks
 * AND when sizing a new placement, so a 15-min block at 9:00 prevents
 * another 15-min block from landing at 9:15.
 */
export function gridSlotsForDuration(durationMinutes: number): number {
  if (durationMinutes <= SLOT_MIN) return 2;
  return Math.max(1, Math.ceil(durationMinutes / SLOT_MIN));
}

// ─────────────────────────────────────────────────────────
// SCHEDULER CONFIGURATION
// ─────────────────────────────────────────────────────────

export interface SchedulerConfig {
  primeStart: number;       // hour, e.g. 8
  primeEnd: number;         // hour, e.g. 12
  dayStart: number;         // hour, e.g. 6
  dayEnd: number;           // hour, e.g. 20
  breakMinutes: number;     // e.g. 15
  maxDailyMinutes: number;  // e.g. 600 (10h)
  workDays: number[];       // e.g. [1,2,3,4,5]
}

const DEFAULT_CONFIG: SchedulerConfig = {
  primeStart: 8,
  primeEnd: 12,
  dayStart: 6,
  dayEnd: 20,
  breakMinutes: 15,
  maxDailyMinutes: 600,
  workDays: [1, 2, 3, 4, 5],
};

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

export interface ScheduleSlot {
  date: string;          // YYYY-MM-DD
  startHour: number;     // 0..23
  startMinute: number;   // 0, 15, 30, 45
  durationMinutes: number;
  taskId: string;
  title: string;
  company: Company;
  taskType: string | null;
  score: number;
}

// ─────────────────────────────────────────────────────────
// CORE SCHEDULER
// ─────────────────────────────────────────────────────────

/**
 * Compute the prime-eligible task-id set used by both scheduleDay and
 * scheduleWeek. As of item 04 of the daily-planning scope, only tasks in
 * the score-based top-3 OR user-pinned tasks claim prime-hour slots.
 * Non-eligible tasks try non-prime slots first and only spill into prime
 * if everything eligible is already placed. Pin = score 100, so pinned
 * tasks naturally enter top-3 first; when more than 3 tasks are pinned,
 * the extras still pass through this set via the userPinned union.
 */
export function computePrimeEligibleIds(tasks: Task[]): Set<string> {
  const top3 = selectTop3(tasks);
  const ids = new Set<string>(top3.map((t) => t.id));
  for (const t of tasks) {
    if (t.userPinned) ids.add(t.id);
  }
  return ids;
}

/**
 * `earliestStartSlot` clamps the day's first available slot upward. Pass
 * it when scheduling today after some of the day has elapsed — the
 * rescheduler does this so a task can't land at 9:00 when "now" is 9:42.
 * For future days, leave undefined and the configured dayStart applies.
 *
 * `primeEligibleTaskIds` is the set of task ids that may claim prime-hour
 * slots first. When omitted, no task is prime-eligible (everyone tries
 * non-prime first), which is a safe fallback but defeats the item-04
 * rule. Callers should derive it via `computePrimeEligibleIds(tasks)`
 * once per scheduling pass and pass it down so the set is stable across
 * days within a week.
 *
 * `mustTodayTaskIds` is the set of task ids that must place today (item
 * 05). Placement runs in three passes — prime-eligibles (top-3 ∪
 * pinned, including any must-today member) first, must-today-only
 * second, non-eligibles third — so a non-pinned must-today task claims
 * slots ahead of non-eligibles but only after top-3/pinned have taken
 * their prime slots. They prefer non-prime hours unless also
 * `userPinned` (pin overrides). Callers should only pass this set when
 * `date` is today; for future days, leave undefined.
 */
export function scheduleDay(
  tasks: Task[],
  date: Date,
  existingBlocks: TimeBlock[],
  config: SchedulerConfig = DEFAULT_CONFIG,
  earliestStartSlot?: number,
  primeEligibleTaskIds?: Set<string>,
  mustTodayTaskIds?: Set<string>,
): ScheduleSlot[] {
  const dateStr = format(date, 'yyyy-MM-dd');

  // Filter to schedulable tasks
  const schedulable = tasks
    .filter((t) => t.status === TaskStatus.QUEUED || t.status === TaskStatus.BACKLOG)
    .map((t) => ({ task: t, score: calculateScore(t) }))
    .sort((a, b) => b.score - a.score);

  // Build occupied set from existing blocks, keyed by 15-minute slot index
  // (slot index = (startHour * 60 + startMinute) / 15). Use
  // gridSlotsForDuration for symmetry with new-task placement: a stored
  // 15-min block reserves 2 slots so a future 15-min task can't land in
  // the adjacent :15.
  const occupied = new Set<string>();
  for (const block of existingBlocks) {
    const blockDate = format(block.date, 'yyyy-MM-dd');
    const startSlot = (block.startHour * 60 + block.startMinute) / SLOT_MIN;
    const slotsTaken = gridSlotsForDuration(block.durationMinutes);
    for (let i = 0; i < slotsTaken; i++) {
      occupied.add(`${blockDate}-${startSlot + i}`);
    }
  }

  const dayStartSlot = config.dayStart * SLOTS_PER_HOUR;
  const dayEndSlot = config.dayEnd * SLOTS_PER_HOUR;
  const primeStartSlot = config.primeStart * SLOTS_PER_HOUR;
  const primeEndSlot = config.primeEnd * SLOTS_PER_HOUR;

  // Effective day-start. The caller may push it forward when scheduling
  // today after some slots have elapsed; future days pass nothing.
  const effectiveDayStartSlot = earliestStartSlot != null
    ? Math.max(dayStartSlot, earliestStartSlot)
    : dayStartSlot;

  const allSlots = Array.from(
    { length: Math.max(0, dayEndSlot - effectiveDayStartSlot) },
    (_, i) => effectiveDayStartSlot + i
  );
  const primeSlots = allSlots.filter((s) => s >= primeStartSlot && s < primeEndSlot);
  const nonPrimeSlots = allSlots.filter((s) => s < primeStartSlot || s >= primeEndSlot);

  const results: ScheduleSlot[] = [];
  let dailyMinutesUsed = existingBlocks
    .filter((b) => format(b.date, 'yyyy-MM-dd') === dateStr)
    .reduce((sum, b) => sum + b.durationMinutes, 0);

  // Three-pass placement (refined after the item-05 audit).
  //
  // Pass 1 — prime-eligibles (item 04): top-3 ∪ pinned, INCLUDING any
  // task that is also must-today. Eligibles always run before any non-
  // eligible — including non-pinned must-today — so top-3/pinned claim
  // their prime slots before must-today tasks compete for the leftover.
  // This was the audit's key finding: in the prior pass-1-of-must-today
  // order, a non-pinned must-today with `[nonPrime, prime]` could
  // preempt a lower-score top-3 task that hadn't iterated yet.
  //
  // Pass 2 — must-today-only (item 05): tasks marked must-today that
  // are NOT prime-eligible. They prefer non-prime; they may fall back
  // to prime ONLY if non-prime is full AND eligibles have already
  // placed in Pass 1. Tasks that don't fit anywhere stay unscheduled.
  //
  // Pass 3 — non-eligibles: non-prime-first with prime as fallback.
  // Inherits the looser interpretation of item 04 ("excluded when prime
  // is full"). Pass-1 leftover prime can be claimed here.
  //
  // Within each pass, score order is preserved (the source `schedulable`
  // is already sorted desc). When the relevant Set is undefined, the
  // partition for that pass collapses gracefully.
  const eligibles = schedulable.filter(({ task }) => primeEligibleTaskIds?.has(task.id));
  const mustTodayOnly = schedulable.filter(({ task }) =>
    mustTodayTaskIds?.has(task.id) && !primeEligibleTaskIds?.has(task.id),
  );
  const nonEligibles = schedulable.filter(({ task }) =>
    !mustTodayTaskIds?.has(task.id) && !primeEligibleTaskIds?.has(task.id),
  );
  const ordered = [...eligibles, ...mustTodayOnly, ...nonEligibles];

  for (const { task, score } of ordered) {
    // Snap the task's estimate upward to the nearest :15 multiple. The
    // block end-time is start + alignedDuration; aligning here is what
    // keeps end-times :15-aligned even when the user entered a 20- or
    // 25-minute estimate. The task's estimatedMinutes is left untouched.
    const alignedDuration = Math.ceil(task.estimatedMinutes / SLOT_MIN) * SLOT_MIN;

    // Check daily capacity against the value we will actually consume.
    if (dailyMinutesUsed + alignedDuration > config.maxDailyMinutes) {
      continue;
    }

    const slotsNeeded = gridSlotsForDuration(task.estimatedMinutes);

    // Slot order, per item 04 + 05:
    //   - userPinned: prime-first, always (pin overrides everything).
    //   - prime-eligible (top-3 ∪ pinned) AND NOT must-today: prime-first.
    //   - must-today AND NOT pinned (regardless of top-3): non-prime-first.
    //     Item 05's "preferring non-prime hours unless also userPinned"
    //     wins over item 04's "top-3 own prime" when both apply to the
    //     same task. A non-pinned must-today + top-3 task therefore
    //     places first (Pass 1, eligibles) but still tries non-prime
    //     before prime.
    //   - everyone else: non-prime-first, prime as fallback.
    const isMustToday = mustTodayTaskIds?.has(task.id) ?? false;
    const isPrimeEligible = primeEligibleTaskIds?.has(task.id) ?? false;
    const preferPrime = task.userPinned || (isPrimeEligible && !isMustToday);

    const slotOrder = preferPrime
      ? [...primeSlots, ...nonPrimeSlots]
      : [...nonPrimeSlots, ...primeSlots];

    // Find contiguous available slots
    for (const startSlot of slotOrder) {
      if (startSlot + slotsNeeded > dayEndSlot) continue;

      let canPlace = true;
      for (let s = 0; s < slotsNeeded; s++) {
        if (occupied.has(`${dateStr}-${startSlot + s}`)) {
          canPlace = false;
          break;
        }
      }

      if (canPlace) {
        for (let s = 0; s < slotsNeeded; s++) {
          occupied.add(`${dateStr}-${startSlot + s}`);
        }
        const startHour = Math.floor(startSlot / SLOTS_PER_HOUR);
        const startMinute = (startSlot % SLOTS_PER_HOUR) * SLOT_MIN;
        results.push({
          date: dateStr,
          startHour,
          startMinute,
          durationMinutes: alignedDuration,
          taskId: task.id,
          title: task.title,
          company: task.company,
          taskType: task.taskType,
          score,
        });
        dailyMinutesUsed += alignedDuration;
        break;
      }
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────
// WEEK SCHEDULER
// ─────────────────────────────────────────────────────────

/**
 * `earliestStartSlotForToday` clamps only today's first available slot;
 * future days fall back to the configured dayStart. The rescheduler passes
 * this when scheduling mid-day so already-elapsed :15 slots are skipped.
 *
 * Prime eligibility is computed once over the full schedulable task pool
 * via `computePrimeEligibleIds` and passed to every day iteration so
 * top-3 membership is stable across the week.
 */
export function scheduleWeek(
  tasks: Task[],
  existingBlocks: TimeBlock[],
  config: SchedulerConfig = DEFAULT_CONFIG,
  startDate?: Date,
  earliestStartSlotForToday?: number,
): ScheduleSlot[] {
  const weekStart = startDate || startOfWeek(new Date(), { weekStartsOn: 1 });
  const todayStart = startOfDay(new Date());
  const allSlots: ScheduleSlot[] = [];
  const scheduledTaskIds = new Set<string>();

  // Score and sort all tasks
  const scoredTasks = tasks
    .filter((t) => t.status === TaskStatus.QUEUED || t.status === TaskStatus.BACKLOG)
    .map((t) => ({ task: t, score: calculateScore(t) }))
    .sort((a, b) => b.score - a.score);

  // Prime eligibility is week-stable: compute once over the schedulable
  // pool, not per day, so a task doesn't lose top-3 status simply because
  // an earlier day already placed someone else.
  const primeEligibleTaskIds = computePrimeEligibleIds(scoredTasks.map((s) => s.task));

  // Must-today (item 05): only today's iteration should see these tasks;
  // a must-today that fails to fit today must NOT spill to tomorrow.
  const mustTodayTaskIds = new Set<string>(
    scoredTasks.filter(({ task }) => task.mustBeDoneToday).map(({ task }) => task.id),
  );

  // Distribute tasks across work days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = addDays(weekStart, dayOffset);

    // Never place blocks in the past — skip days strictly before today.
    if (startOfDay(date) < todayStart) continue;

    const dayOfWeek = date.getDay();

    if (!config.workDays.includes(dayOfWeek)) continue;

    const isToday = startOfDay(date).getTime() === todayStart.getTime();

    // Filter to unscheduled tasks. Must-today tasks are excluded from
    // non-today days so they can't slip into tomorrow when today's
    // capacity runs out — overflow returns to the queue as unscheduled
    // (item 05 contract; no auto-deferral).
    const remaining = scoredTasks.filter(({ task }) =>
      !scheduledTaskIds.has(task.id) && (isToday || !mustTodayTaskIds.has(task.id)),
    );

    const daySlots = scheduleDay(
      remaining.map(({ task }) => task),
      date,
      existingBlocks,
      config,
      isToday ? earliestStartSlotForToday : undefined,
      primeEligibleTaskIds,
      isToday ? mustTodayTaskIds : undefined,
    );

    for (const slot of daySlots) {
      scheduledTaskIds.add(slot.taskId);
      allSlots.push(slot);
    }
  }

  return allSlots;
}

// ─────────────────────────────────────────────────────────
// RESCHEDULER
// ─────────────────────────────────────────────────────────
// When a new task arrives, only reschedule blocks that
// haven't started yet. Never touch in-progress or completed.

/**
 * Operator-local "now" for rescheduleFromNow. The route is responsible for
 * deriving these from the user's preferred timezone via toLocalDateString /
 * zonedHour / zonedMinute. Passing them in (rather than reading
 * `new Date()` here) keeps the past-block test correct when the server's
 * TZ env differs from the operator's.
 */
export interface ReschedulerNow {
  date: Date;          // a Date that represents "now" — used as scheduleWeek's startDate
  todayStr: string;    // YYYY-MM-DD in the operator's local zone
  currentHour: number; // 0..23 in the operator's local zone
  currentMinute: number; // 0..59 in the operator's local zone
}

export function rescheduleFromNow(
  tasks: Task[],
  existingBlocks: TimeBlock[],
  config: SchedulerConfig = DEFAULT_CONFIG,
  now: ReschedulerNow,
): {
  keep: TimeBlock[];
  remove: TimeBlock[];
  add: ScheduleSlot[];
} {
  const { todayStr, currentHour, currentMinute } = now;

  // Split blocks: keep completed/in-progress/past, reschedule future.
  // "Past" is :15-aware so a 9:45 block at 9:30 is still future-live.
  const keep: TimeBlock[] = [];
  const remove: TimeBlock[] = [];

  for (const block of existingBlocks) {
    const blockDate = format(block.date, 'yyyy-MM-dd');
    const isPast =
      blockDate < todayStr ||
      (blockDate === todayStr &&
        (block.startHour < currentHour ||
          (block.startHour === currentHour && block.startMinute <= currentMinute)));

    if (block.completed || isPast) {
      keep.push(block);
    } else {
      remove.push(block);
    }
  }

  // Today's first available :15 slot, rounded up from "now". Math.ceil
  // handles 9:42 → 9:45, 9:45 → 9:45, 9:46 → 10:00. Future days are
  // unaffected; scheduleWeek applies this clamp only to the today
  // iteration.
  const earliestStartSlotForToday = Math.ceil((currentHour * 60 + currentMinute) / SLOT_MIN);

  // Reschedule with only kept blocks as constraints
  const add = scheduleWeek(tasks, keep, config, now.date, earliestStartSlotForToday);

  return { keep, remove, add };
}
