import { Task, TaskStatus } from '@prisma/client';
import { getISOWeek, getISOWeekYear, differenceInCalendarDays } from 'date-fns';

// ─────────────────────────────────────────────────────────
// COMPOSITE SCORE CALCULATION
// ─────────────────────────────────────────────────────────
// Produces a 0-100 score that determines scheduling order.
// Higher score = gets scheduled first, gets better time slots.

export function calculateScore(task: Task): number {
  let score = 0;

  // Priority weight (0-100 contribution, scaled)
  score += (task.priority / 10) * 30;

  // Urgency weight
  score += (task.urgency / 10) * 25;

  // Strategic bonus — strategic work should win tiebreakers
  if (task.isStrategic) score += 12;

  // Carryover escalation — each week carried increases urgency
  if (task.carryover) {
    score += 8 + (task.carryoverCount * 4); // escalates over time
  }

  // Due date proximity — approaching deadlines spike the score
  if (task.dueDate) {
    const daysUntil = differenceInCalendarDays(task.dueDate, new Date());
    if (daysUntil < 0) score += 30;        // overdue
    else if (daysUntil === 0) score += 25;  // due today
    else if (daysUntil <= 1) score += 20;
    else if (daysUntil <= 3) score += 12;
    else if (daysUntil <= 7) score += 6;
  }

  // Reactive penalty — slight deprioritization unless urgent
  if (task.isReactive && task.urgency < 7) {
    score -= 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─────────────────────────────────────────────────────────
// TOP 3 WEEKLY PRIORITIES
// ─────────────────────────────────────────────────────────
// Selects the 3 most important tasks for the week.
// Biases toward strategic work and cross-company balance.

export function selectTop3(tasks: Task[]): Task[] {
  const active = tasks.filter(
    (t) => t.status !== TaskStatus.COMPLETE && t.status !== TaskStatus.DROPPED
  );

  // Score and sort
  const scored = active
    .map((t) => ({ task: t, score: calculateScore(t) }))
    .sort((a, b) => b.score - a.score);

  // Pick top 3, but try to spread across companies
  const top3: Task[] = [];
  const companiesSeen = new Set<string>();

  // First pass: take highest score per unique company
  for (const { task } of scored) {
    if (top3.length >= 3) break;
    if (!companiesSeen.has(task.company)) {
      top3.push(task);
      companiesSeen.add(task.company);
    }
  }

  // Second pass: fill remaining slots with highest scores
  for (const { task } of scored) {
    if (top3.length >= 3) break;
    if (!top3.includes(task)) {
      top3.push(task);
    }
  }

  return top3;
}

// ─────────────────────────────────────────────────────────
// OVERLOAD DETECTION
// ─────────────────────────────────────────────────────────

export interface OverloadReport {
  totalMinutes: number;
  availableMinutes: number;
  overloaded: boolean;
  overloadMinutes: number;
  taskCount: number;
  suggestion: string;
}

export function detectOverload(
  tasks: Task[],
  availableHoursPerDay: number = 8,
  workDays: number = 5
): OverloadReport {
  const active = tasks.filter(
    (t) => t.status !== TaskStatus.COMPLETE && t.status !== TaskStatus.DROPPED
  );

  const totalMinutes = active.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  const availableMinutes = availableHoursPerDay * 60 * workDays;
  const overloaded = totalMinutes > availableMinutes;
  const overloadMinutes = Math.max(0, totalMinutes - availableMinutes);

  let suggestion = '';
  if (overloaded) {
    const hoursOver = Math.round(overloadMinutes / 60);
    const lowestScored = [...active]
      .sort((a, b) => calculateScore(a) - calculateScore(b))
      .slice(0, 3);
    suggestion = `You're ${hoursOver}h over capacity this week. Consider deferring: ${lowestScored.map((t) => `"${t.title}"`).join(', ')}`;
  }

  return {
    totalMinutes,
    availableMinutes,
    overloaded,
    overloadMinutes,
    taskCount: active.length,
    suggestion,
  };
}

// ─────────────────────────────────────────────────────────
// COMPANY BALANCE CHECK
// ─────────────────────────────────────────────────────────

export interface CompanyBalance {
  company: string;
  minutes: number;
  percentage: number;
  isStarving: boolean;    // < 15% and > 0 tasks
  isDominating: boolean;  // > 50%
}

export function analyzeCompanyBalance(tasks: Task[]): CompanyBalance[] {
  const active = tasks.filter(
    (t) =>
      t.status !== TaskStatus.COMPLETE &&
      t.status !== TaskStatus.DROPPED &&
      t.company !== 'PERSONAL'
  );

  const totalMinutes = active.reduce((sum, t) => sum + t.estimatedMinutes, 0);

  const companies = ['APERTURE_ADS', 'RENTALS', 'DIYP'] as const;

  return companies.map((company) => {
    const compTasks = active.filter((t) => t.company === company);
    const minutes = compTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
    const percentage = totalMinutes > 0 ? (minutes / totalMinutes) * 100 : 0;

    return {
      company,
      minutes,
      percentage: Math.round(percentage),
      isStarving: percentage < 15 && compTasks.length > 0,
      isDominating: percentage > 50,
    };
  });
}

// ─────────────────────────────────────────────────────────
// WEEK UTILITIES
// ─────────────────────────────────────────────────────────

export function getCurrentWeek(): { week: number; year: number } {
  const now = new Date();
  return {
    week: getISOWeek(now),
    year: getISOWeekYear(now),
  };
}
