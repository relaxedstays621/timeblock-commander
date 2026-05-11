export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { scheduleDay, scheduleWeek, rescheduleFromNow, computePrimeEligibleIds } from '@/lib/scheduler';
import { selectTop3, detectOverload, analyzeCompanyBalance, calculateScore } from '@/lib/scoring';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { getCurrentUser } from '@/lib/auth';
import { liveBlockFilter } from '@/lib/blocks';
import { resolveTimezone, zonedHour, zonedMinute } from '@/lib/timezone';
import { toLocalDateString } from '@/lib/local-date';
import type { TaskType } from '@prisma/client';

// POST /api/schedule
// body: { action: "day" | "week" | "reschedule", date?: string }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser({ includePreferences: true });
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const body = await req.json();
  const action = body.action || 'day';
  const date = body.date ? parseISO(body.date) : new Date();

  const prefs = (user as any).preferences;
  const config = {
    primeStart: prefs?.primeHoursStart ?? 8,
    primeEnd: prefs?.primeHoursEnd ?? 12,
    dayStart: 6,
    dayEnd: 20,
    breakMinutes: prefs?.breakMinutes ?? 15,
    maxDailyMinutes: (prefs?.maxDailyHours ?? 10) * 60,
    workDays: prefs?.workDays ?? [1, 2, 3, 4, 5],
  };

  // Wrap the entire pre-clear + plan + insert + status-update in one
  // interactive transaction so a failed insert (e.g. unique-constraint on
  // (userId, date, startHour)) rolls the clear back instead of leaving the
  // user with a wiped calendar and no replacement.
  const created = await prisma.$transaction(
    async (tx) => {
      // Stale-scheduled sweep — runs before every branch.
      //
      // A task is "stale-scheduled" when it has linked blocks but every
      // single one of those blocks is stale: the block's date is strictly
      // before today (in the user's local timezone) or the block has been
      // marked completed. Such a task has no live plan; its place on the
      // calendar has elapsed without being executed. The downstream
      // planner's filter would otherwise treat these as already scheduled
      // and skip them, leaving the user unable to re-place them via
      // Schedule Week / Schedule Day.
      //
      // We deliberately do NOT key off the literal Task.status === 'SCHEDULED'
      // value — the status enum is being refactored and this predicate
      // should survive the rename. Excluding tasks whose `completedAt` is
      // already set keeps us from resurrecting genuinely finished work.
      const userTz = resolveTimezone(prefs);
      const now = new Date();
      const todayLocalStr = toLocalDateString(now, userTz);
      // todayStart = midnight UTC of the user's local calendar day. Block
      // dates are @db.Date (midnight UTC of the stored day), so a strict
      // `< todayStart` correctly classifies "yesterday or earlier" as past.
      const todayStart = new Date(todayLocalStr);
      // currentHour and currentMinute drive the same-day "has this slot
      // already elapsed" check inside liveBlockFilter. Both axes are
      // required now that blocks can land on any :15 boundary; an
      // hour-only check would mis-classify a 9:45 block at 9:30 as past.
      const currentHour = zonedHour(now, userTz);
      const currentMinute = zonedMinute(now, userTz);
      // Today's first available :15 slot, rounded up. Used by every
      // scheduling branch (today / week / reschedule) so a Schedule Today
      // press at 9:42 cannot land a block at 9:00. scheduleWeek applies
      // this clamp only to whichever iterated day equals today.
      const earliestStartSlotForToday = Math.ceil((currentHour * 60 + currentMinute) / 15);

      const staleScheduled = await tx.task.findMany({
        where: {
          userId: user.id,
          completedAt: null,
          blocks: {
            some: {},                                                          // has at least one block
            none: liveBlockFilter(todayStart, currentHour, currentMinute),     // none of them are live
          },
        },
        select: { id: true, blocks: { select: { id: true } } },
      });

      if (staleScheduled.length > 0) {
        const staleTaskIds = staleScheduled.map((t) => t.id);
        const staleBlockIds = staleScheduled.flatMap((t) => t.blocks).map((b) => b.id);

        if (staleBlockIds.length > 0) {
          await tx.timeBlock.deleteMany({
            where: { id: { in: staleBlockIds }, userId: user.id },
          });
        }
        await tx.task.updateMany({
          where: { id: { in: staleTaskIds }, userId: user.id },
          data: { status: 'QUEUED' },
        });
      }

      let slots;

      if (action === 'reschedule') {
        // Fetch tasks and blocks INSIDE the tx, after the sweep, so we
        // observe the post-sweep state.
        const tasks = await tx.task.findMany({
          where: {
            userId: user.id,
            status: { in: ['QUEUED', 'BACKLOG', 'SCHEDULED'] },
          },
        });
        const existingBlocks = await tx.timeBlock.findMany({
          where: { userId: user.id },
        });

        // First pass: classify blocks (keep = past/completed; remove =
        // future/uncompleted). The `add` from this call is unreliable
        // because tasks linked to to-be-removed blocks are still SCHEDULED
        // in this snapshot — the planner's filter would drop them.
        const reschedulerNow = {
          date: now,
          todayStr: todayLocalStr,
          currentHour,
          currentMinute,
        };
        const { keep, remove } = rescheduleFromNow(tasks, existingBlocks, config, reschedulerNow);

        if (remove.length > 0) {
          await tx.timeBlock.deleteMany({
            where: { id: { in: remove.map((b) => b.id) } },
          });

          // Reset task status for any task whose blocks are now all stale
          // (or zero) after the removal. Reuses the same "no live block"
          // predicate as the leading sweep so the rule is consistent.
          // Without this, a task whose only block was just removed stays
          // SCHEDULED and the second planner pass would still drop it.
          const affectedTaskIds = remove
            .map((b) => b.taskId)
            .filter((id): id is string => Boolean(id));
          if (affectedTaskIds.length > 0) {
            await tx.task.updateMany({
              where: {
                userId: user.id,
                id: { in: affectedTaskIds },
                completedAt: null,
                blocks: { none: liveBlockFilter(todayStart, currentHour, currentMinute) },
              },
              data: { status: 'QUEUED' },
            });
          }
        }

        // Second pass: refetch tasks (now reflecting the resets above) and
        // run the planner against the survivor blocks (`keep`). Passing
        // `keep` instead of the full block set means the classifier sees
        // nothing to remove this time around — keep stays kept, remove
        // is empty, and `add` is the real plan.
        const freshTasks = await tx.task.findMany({
          where: {
            userId: user.id,
            status: { in: ['QUEUED', 'BACKLOG', 'SCHEDULED'] },
          },
        });
        const replan = rescheduleFromNow(freshTasks, keep, config, reschedulerNow);
        slots = replan.add;
      } else if (action === 'week') {
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(date, { weekStartsOn: 1 });

        // Item 09: Schedule Week is additive — no clearBlocks call.
        // Existing blocks in the week are immutable survivors that the
        // planner packs around. The eligibility filter below prevents
        // re-placing tasks that already have a live block in the range.

        const freshTasks = await tx.task.findMany({
          where: {
            userId: user.id,
            status: { in: ['QUEUED', 'BACKLOG', 'SCHEDULED'] },
          },
        });

        const survivingBlocks = await tx.timeBlock.findMany({
          where: { userId: user.id },
        });

        // Item 09 task-eligibility filter. Mirrors liveBlockFilter
        // semantics in code so we can apply it to the in-memory block set:
        // a block gates eligibility iff it is non-completed AND its slot
        // is today-or-future. scheduleWeek already skips past days, so
        // past-day blocks for an unscheduled task are irrelevant. The
        // today-special-case requires the slot to still be ahead of now.
        const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
        const alreadyScheduledTaskIds = new Set<string>(
          survivingBlocks
            .filter((b) => {
              if (b.completed) return false;
              const blockDateStr = format(b.date, 'yyyy-MM-dd');
              if (blockDateStr < todayLocalStr || blockDateStr > weekEndStr) return false;
              if (blockDateStr === todayLocalStr) {
                return (
                  b.startHour > currentHour ||
                  (b.startHour === currentHour && b.startMinute > currentMinute)
                );
              }
              return true;
            })
            .map((b) => b.taskId)
            .filter((id): id is string => Boolean(id)),
        );

        const eligibleTasks = freshTasks.filter((t) => !alreadyScheduledTaskIds.has(t.id));

        slots = scheduleWeek(eligibleTasks, survivingBlocks, config, date, earliestStartSlotForToday);
      } else {
        const dateStr = format(date, 'yyyy-MM-dd');

        // Item 09: Schedule Today is additive — no clearBlocks call.
        // Existing blocks for the target date are immutable survivors
        // that scheduleDay packs around (via its `occupied` set). The
        // eligibility filter below prevents re-placing tasks that
        // already hold a live block on this date.

        const freshTasks = await tx.task.findMany({
          where: {
            userId: user.id,
            status: { in: ['QUEUED', 'BACKLOG', 'SCHEDULED'] },
          },
        });

        const survivingBlocks = await tx.timeBlock.findMany({
          where: { userId: user.id },
        });

        // Clamp first slot only when scheduling today. Future days fall
        // back to config.dayStart; past days are out of bounds upstream.
        const isToday = dateStr === todayLocalStr;

        // Item 09 task-eligibility filter. A task is ineligible iff it
        // already has a live block on the target date. For today, "live"
        // requires the slot to still be ahead of now (matches
        // liveBlockFilter). For a future day, any non-completed block on
        // that date counts.
        const alreadyScheduledTaskIds = new Set<string>(
          survivingBlocks
            .filter((b) => {
              if (b.completed) return false;
              if (format(b.date, 'yyyy-MM-dd') !== dateStr) return false;
              if (!isToday) return true;
              return (
                b.startHour > currentHour ||
                (b.startHour === currentHour && b.startMinute > currentMinute)
              );
            })
            .map((b) => b.taskId)
            .filter((id): id is string => Boolean(id)),
        );

        // Must-today (item 05) only applies when the target date is
        // today. For future-day schedules, strip must-today tasks from
        // the pool entirely so they don't accidentally land on a future
        // day — overflow stays in the queue, unscheduled.
        const dayTasks = (isToday
          ? freshTasks
          : freshTasks.filter((t) => !t.mustBeDoneToday)
        ).filter((t) => !alreadyScheduledTaskIds.has(t.id));

        // Prime-eligible ids for this day: top-3 + pinned over the same
        // schedulable pool the scheduler is about to consider, so the
        // item-04 rule applies to the single-day path identically to
        // the week path.
        const primeEligibleTaskIds = computePrimeEligibleIds(
          dayTasks.filter((t) => t.status === 'QUEUED' || t.status === 'BACKLOG'),
        );

        // Must-today ids — only populate when scheduling today.
        const mustTodayTaskIds = isToday
          ? new Set<string>(dayTasks.filter((t) => t.mustBeDoneToday).map((t) => t.id))
          : undefined;

        slots = scheduleDay(
          dayTasks,
          date,
          survivingBlocks,
          config,
          isToday ? earliestStartSlotForToday : undefined,
          primeEligibleTaskIds,
          mustTodayTaskIds,
        );
      }

      if (slots.length === 0) return [];

      const blocks = await tx.timeBlock.createManyAndReturn({
        data: slots.map((slot) => ({
          date: new Date(slot.date),
          startHour: slot.startHour,
          startMinute: slot.startMinute,
          durationMinutes: slot.durationMinutes,
          title: slot.title,
          company: slot.company,
          taskType: slot.taskType as TaskType | null,
          taskId: slot.taskId,
          userId: user.id,
        })),
      });

      // Intentionally NOT writing `status: 'SCHEDULED'` here. As of item 03,
      // "scheduled" is a derived state computed from the presence of blocks
      // in the operator's local this-week range (see GET /api/tasks). The
      // stored TaskStatus enum still carries SCHEDULED for backward
      // compatibility with legacy rows; no new writes produce that value.

      return blocks;
    },
    // Scheduling can touch many rows; bump above the 5s default so a busy
    // user with a full week doesn't time out mid-tx.
    { timeout: 30_000 }
  );

  // Generate insights
  const allTasks = await prisma.task.findMany({ where: { userId: user.id } });
  const top3 = selectTop3(allTasks);
  const overload = detectOverload(allTasks);
  const balance = analyzeCompanyBalance(allTasks);

  return NextResponse.json({
    scheduled: created.length,
    // Item 09: client surfaces a "Nothing new to schedule" toast when this
    // is true. The flag is true whenever the planner produced zero new
    // placements — distinguishes the success-but-no-op case from an error.
    nothingNew: created.length === 0,
    blocks: created,
    insights: {
      top3: top3.map((t) => ({
        id: t.id,
        title: t.title,
        company: t.company,
        score: calculateScore(t),
      })),
      overload,
      companyBalance: balance,
    },
  });
}

// GET /api/schedule?date=YYYY-MM-DD — get blocks for a date
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');

  const blocks = await prisma.timeBlock.findMany({
    where: {
      userId: user.id,
      date: new Date(dateStr),
    },
    include: { task: true },
    orderBy: [{ startHour: 'asc' }, { startMinute: 'asc' }],
  });

  return NextResponse.json(blocks);
}
