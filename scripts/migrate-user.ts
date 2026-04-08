/**
 * One-shot migration: reassign all data owned by the seed user
 * (owner@timeblock.local) to a Google-authenticated user identified by email.
 *
 * Moves:
 *   - Task           (no unique constraint per-user → safe updateMany)
 *   - TimeBlock      (unique on userId, date, startHour — checked for collisions)
 *   - WeeklyGoal     (unique on userId, weekNumber, yearNumber — checked)
 *   - UserPreferences (unique on userId — only moved if target has none)
 *
 * Accounts, Sessions, and the source User row itself are left untouched so
 * that sign-in continues to work and the seed user can be dropped manually
 * later if desired.
 *
 * Usage:
 *   npx tsx scripts/migrate-user.ts <google-email>
 *
 *   # Inside Docker:
 *   docker exec timeblock-app npx tsx scripts/migrate-user.ts you@gmail.com
 */

import { PrismaClient } from '@prisma/client';

const SOURCE_EMAIL = 'owner@timeblock.local';

async function main() {
  const targetEmail = process.argv[2];
  if (!targetEmail) {
    console.error('Usage: npx tsx scripts/migrate-user.ts <google-email>');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const source = await prisma.user.findUnique({
      where: { email: SOURCE_EMAIL },
    });
    if (!source) {
      console.error(`Source user "${SOURCE_EMAIL}" not found — nothing to migrate.`);
      process.exit(1);
    }

    const target = await prisma.user.findUnique({
      where: { email: targetEmail },
    });
    if (!target) {
      console.error(
        `Target user "${targetEmail}" not found. Sign in via Google at least once first ` +
        `so NextAuth creates the User row, then re-run this script.`
      );
      process.exit(1);
    }

    if (source.id === target.id) {
      console.error('Source and target are the same user. Nothing to do.');
      process.exit(1);
    }

    console.log(`Source:  ${source.email}  (${source.id})`);
    console.log(`Target:  ${target.email}  (${target.id})`);
    console.log('');

    // ─── Pre-check for collisions that updateMany can't resolve ────────────
    // TimeBlock: unique(userId, date, startHour)
    const sourceBlocks = await prisma.timeBlock.findMany({
      where: { userId: source.id },
      select: { date: true, startHour: true },
    });

    const blockCollisions: string[] = [];
    for (const b of sourceBlocks) {
      const conflict = await prisma.timeBlock.findUnique({
        where: {
          userId_date_startHour: {
            userId: target.id,
            date: b.date,
            startHour: b.startHour,
          },
        },
      });
      if (conflict) {
        blockCollisions.push(`${b.date.toISOString().slice(0, 10)} @ hour ${b.startHour}`);
      }
    }

    // WeeklyGoal: unique(userId, weekNumber, yearNumber)
    const sourceGoals = await prisma.weeklyGoal.findMany({
      where: { userId: source.id },
      select: { weekNumber: true, yearNumber: true },
    });

    const goalCollisions: string[] = [];
    for (const g of sourceGoals) {
      const conflict = await prisma.weeklyGoal.findUnique({
        where: {
          userId_weekNumber_yearNumber: {
            userId: target.id,
            weekNumber: g.weekNumber,
            yearNumber: g.yearNumber,
          },
        },
      });
      if (conflict) {
        goalCollisions.push(`${g.yearNumber}-W${g.weekNumber}`);
      }
    }

    if (blockCollisions.length || goalCollisions.length) {
      console.error('Cannot migrate — target user already has conflicting rows:');
      if (blockCollisions.length) {
        console.error(`  TimeBlock collisions: ${blockCollisions.join(', ')}`);
      }
      if (goalCollisions.length) {
        console.error(`  WeeklyGoal collisions: ${goalCollisions.join(', ')}`);
      }
      console.error('Resolve these manually (delete or move) and re-run.');
      process.exit(1);
    }

    // UserPreferences: unique(userId). If target already has one, skip moving
    // source prefs — we don't want to clobber the target's choices.
    const targetPrefs = await prisma.userPreferences.findUnique({
      where: { userId: target.id },
    });

    // ─── Perform the migration inside a single transaction ────────────────
    const result = await prisma.$transaction(async (tx) => {
      const tasks = await tx.task.updateMany({
        where: { userId: source.id },
        data: { userId: target.id },
      });

      const blocks = await tx.timeBlock.updateMany({
        where: { userId: source.id },
        data: { userId: target.id },
      });

      const goals = await tx.weeklyGoal.updateMany({
        where: { userId: source.id },
        data: { userId: target.id },
      });

      let prefsMoved = 0;
      let prefsSkipped = 0;
      if (targetPrefs) {
        prefsSkipped = 1;
      } else {
        const prefs = await tx.userPreferences.updateMany({
          where: { userId: source.id },
          data: { userId: target.id },
        });
        prefsMoved = prefs.count;
      }

      return {
        tasks: tasks.count,
        blocks: blocks.count,
        goals: goals.count,
        prefsMoved,
        prefsSkipped,
      };
    });

    console.log('Migration complete:');
    console.log(`  Tasks reassigned:        ${result.tasks}`);
    console.log(`  TimeBlocks reassigned:   ${result.blocks}`);
    console.log(`  WeeklyGoals reassigned:  ${result.goals}`);
    console.log(`  UserPreferences moved:   ${result.prefsMoved}`);
    if (result.prefsSkipped) {
      console.log(
        `  UserPreferences skipped: ${result.prefsSkipped} ` +
        `(target user already had their own; source's were left in place)`
      );
    }
    console.log('');
    console.log(
      `Source user "${SOURCE_EMAIL}" was left intact. You can delete it later with:`
    );
    console.log(`  prisma.user.delete({ where: { email: "${SOURCE_EMAIL}" } })`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
