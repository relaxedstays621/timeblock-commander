import { Task, TimeBlock, Company, EnergyLevel, TaskStatus } from '@prisma/client';
import { calculateScore } from './scoring';
import { format, addDays, startOfWeek } from 'date-fns';

// ─────────────────────────────────────────────────────────
// SCHEDULER CONFIGURATION
// ─────────────────────────────────────────────────────────

export interface SchedulerConfig {
  primeStart: number;       // e.g. 8
  primeEnd: number;         // e.g. 12
  dayStart: number;         // e.g. 6
  dayEnd: number;           // e.g. 20
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
  startHour: number;
  durationMinutes: number;
  taskId: string;
  title: string;
  company: Company;
  taskType: string | null;
  score: number;
}

interface OccupiedSlot {
  date: string;
  hour: number;
}

// ─────────────────────────────────────────────────────────
// CORE SCHEDULER
// ─────────────────────────────────────────────────────────

export function scheduleDay(
  tasks: Task[],
  date: Date,
  existingBlocks: TimeBlock[],
  config: SchedulerConfig = DEFAULT_CONFIG
): ScheduleSlot[] {
  const dateStr = format(date, 'yyyy-MM-dd');

  // Filter to schedulable tasks
  const schedulable = tasks
    .filter((t) => t.status === TaskStatus.QUEUED || t.status === TaskStatus.BACKLOG)
    .map((t) => ({ task: t, score: calculateScore(t) }))
    .sort((a, b) => b.score - a.score);

  // Build occupied set from existing blocks
  const occupied = new Set<string>();
  for (const block of existingBlocks) {
    const blockDate = format(block.date, 'yyyy-MM-dd');
    const slots = Math.ceil(block.durationMinutes / 60);
    for (let i = 0; i < slots; i++) {
      occupied.add(`${blockDate}-${block.startHour + i}`);
    }
  }

  // Build hour priority list
  const primeHours = Array.from(
    { length: config.primeEnd - config.primeStart },
    (_, i) => config.primeStart + i
  );
  const nonPrimeHours = Array.from(
    { length: config.dayEnd - config.dayStart },
    (_, i) => config.dayStart + i
  ).filter((h) => h < config.primeStart || h >= config.primeEnd);

  const results: ScheduleSlot[] = [];
  let dailyMinutesUsed = existingBlocks
    .filter((b) => format(b.date, 'yyyy-MM-dd') === dateStr)
    .reduce((sum, b) => sum + b.durationMinutes, 0);

  for (const { task, score } of schedulable) {
    // Check daily capacity
    if (dailyMinutesUsed + task.estimatedMinutes > config.maxDailyMinutes) {
      continue;
    }

    const slotsNeeded = Math.ceil(task.estimatedMinutes / 60);
    const needsPrime =
      task.energyLevel === EnergyLevel.PEAK ||
      task.energyLevel === EnergyLevel.HIGH ||
      score >= 70;

    // Determine hour preference order
    const hourOrder = needsPrime
      ? [...primeHours, ...nonPrimeHours]
      : [...nonPrimeHours, ...primeHours];

    // Find contiguous available slots
    let placed = false;
    for (const hour of hourOrder) {
      if (hour + slotsNeeded > config.dayEnd) continue;

      let canPlace = true;
      for (let s = 0; s < slotsNeeded; s++) {
        if (occupied.has(`${dateStr}-${hour + s}`)) {
          canPlace = false;
          break;
        }
      }

      if (canPlace) {
        // Place the block
        for (let s = 0; s < slotsNeeded; s++) {
          occupied.add(`${dateStr}-${hour + s}`);
        }
        results.push({
          date: dateStr,
          startHour: hour,
          durationMinutes: task.estimatedMinutes,
          taskId: task.id,
          title: task.title,
          company: task.company,
          taskType: task.taskType,
          score,
        });
        dailyMinutesUsed += task.estimatedMinutes;
        placed = true;
        break;
      }
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────
// WEEK SCHEDULER
// ─────────────────────────────────────────────────────────

export function scheduleWeek(
  tasks: Task[],
  existingBlocks: TimeBlock[],
  config: SchedulerConfig = DEFAULT_CONFIG,
  startDate?: Date
): ScheduleSlot[] {
  const weekStart = startDate || startOfWeek(new Date(), { weekStartsOn: 1 });
  const allSlots: ScheduleSlot[] = [];
  const scheduledTaskIds = new Set<string>();

  // Score and sort all tasks
  const scoredTasks = tasks
    .filter((t) => t.status === TaskStatus.QUEUED || t.status === TaskStatus.BACKLOG)
    .map((t) => ({ task: t, score: calculateScore(t) }))
    .sort((a, b) => b.score - a.score);

  // Distribute tasks across work days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = addDays(weekStart, dayOffset);
    const dayOfWeek = date.getDay();

    if (!config.workDays.includes(dayOfWeek)) continue;

    // Filter to unscheduled tasks
    const remaining = scoredTasks.filter(({ task }) => !scheduledTaskIds.has(task.id));

    const daySlots = scheduleDay(
      remaining.map(({ task }) => task),
      date,
      existingBlocks,
      config
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

export function rescheduleFromNow(
  tasks: Task[],
  existingBlocks: TimeBlock[],
  config: SchedulerConfig = DEFAULT_CONFIG
): {
  keep: TimeBlock[];
  remove: TimeBlock[];
  add: ScheduleSlot[];
} {
  const now = new Date();
  const currentHour = now.getHours();
  const todayStr = format(now, 'yyyy-MM-dd');

  // Split blocks: keep completed/in-progress/past, reschedule future
  const keep: TimeBlock[] = [];
  const remove: TimeBlock[] = [];

  for (const block of existingBlocks) {
    const blockDate = format(block.date, 'yyyy-MM-dd');
    const isPast = blockDate < todayStr || (blockDate === todayStr && block.startHour <= currentHour);

    if (block.completed || isPast) {
      keep.push(block);
    } else {
      remove.push(block);
    }
  }

  // Reschedule with only kept blocks as constraints
  const add = scheduleWeek(tasks, keep, config, now);

  return { keep, remove, add };
}
