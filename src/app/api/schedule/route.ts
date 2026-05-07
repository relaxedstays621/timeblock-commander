export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { scheduleDay, scheduleWeek, rescheduleFromNow } from '@/lib/scheduler';
import { selectTop3, detectOverload, analyzeCompanyBalance, calculateScore } from '@/lib/scoring';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { getCurrentUser } from '@/lib/auth';
import { clearBlocks, liveBlockFilter } from '@/lib/blocks';
import { resolveTimezone, zonedHour } from '@/lib/timezone';
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
      // currentHour drives the same-day "has this slot already elapsed"
      // check inside liveBlockFilter. Without it, a 9 AM block at 8 PM
      // would still register as live and the sweep would skip it.
      const currentHour = zonedHour(now, userTz);

      const staleScheduled = await tx.task.findMany({
        where: {
          userId: user.id,
          completedAt: null,
          blocks: {
            some: {},                                            // has at least one block
            none: liveBlockFilter(todayStart, currentHour),      // none of them are live
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
        const { keep, remove } = rescheduleFromNow(tasks, existingBlocks, config);

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
                blocks: { none: liveBlockFilter(todayStart, currentHour) },
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
        const replan = rescheduleFromNow(freshTasks, keep, config);
        slots = replan.add;
      } else if (action === 'week') {
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(date, { weekStartsOn: 1 });

        await clearBlocks(tx, {
          userId: user.id,
          range: { gte: weekStart, lte: weekEnd },
        });

        // Fetch tasks AFTER both the sweep and clearBlocks so the planner
        // observes the fully-reset state. A snapshot taken any earlier
        // would still report tasks that just had their blocks deleted as
        // SCHEDULED, and scheduleWeek's filter would drop them.
        const freshTasks = await tx.task.findMany({
          where: {
            userId: user.id,
            status: { in: ['QUEUED', 'BACKLOG', 'SCHEDULED'] },
          },
        });

        const survivingBlocks = await tx.timeBlock.findMany({
          where: { userId: user.id },
        });

        slots = scheduleWeek(freshTasks, survivingBlocks, config, date);
      } else {
        const dateStr = format(date, 'yyyy-MM-dd');
        const targetDate = new Date(dateStr);

        await clearBlocks(tx, {
          userId: user.id,
          range: targetDate,
        });

        // See note in the 'week' branch — fetch post-sweep + post-clear so
        // the planner sees QUEUED-reset statuses.
        const freshTasks = await tx.task.findMany({
          where: {
            userId: user.id,
            status: { in: ['QUEUED', 'BACKLOG', 'SCHEDULED'] },
          },
        });

        const survivingBlocks = await tx.timeBlock.findMany({
          where: { userId: user.id },
        });

        slots = scheduleDay(freshTasks, date, survivingBlocks, config);
      }

      if (slots.length === 0) return [];

      const blocks = await tx.timeBlock.createManyAndReturn({
        data: slots.map((slot) => ({
          date: new Date(slot.date),
          startHour: slot.startHour,
          durationMinutes: slot.durationMinutes,
          title: slot.title,
          company: slot.company,
          taskType: slot.taskType as TaskType | null,
          taskId: slot.taskId,
          userId: user.id,
        })),
      });

      const taskIds = slots.map((s) => s.taskId);
      if (taskIds.length > 0) {
        await tx.task.updateMany({
          where: { id: { in: taskIds }, userId: user.id },
          data: { status: 'SCHEDULED' },
        });
      }

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
    orderBy: { startHour: 'asc' },
  });

  return NextResponse.json(blocks);
}
