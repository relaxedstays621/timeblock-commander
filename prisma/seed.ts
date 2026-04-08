import { PrismaClient, Company, TaskType, EnergyLevel, TaskStatus, TaskSource } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create a default user (will be replaced by auth in production)
  const user = await prisma.user.upsert({
    where: { email: 'owner@timeblock.local' },
    update: {},
    create: {
      email: 'owner@timeblock.local',
      name: 'Owner',
      preferences: {
        create: {
          primeHoursStart: 8,
          primeHoursEnd: 12,
          maxDailyHours: 10,
          breakMinutes: 15,
          workDays: [1, 2, 3, 4, 5],
          defaultDuration: 60,
        },
      },
    },
  });

  console.log(`Created user: ${user.email}`);

  const tasks = [
    {
      title: 'Review Q2 ad campaign performance',
      description: 'Analyze ROAS across all channels, identify top performers, cut underperformers',
      company: Company.APERTURE_ADS,
      taskType: TaskType.PROMOTION,
      priority: 9,
      urgency: 7,
      estimatedMinutes: 90,
      energyLevel: EnergyLevel.PEAK,
      status: TaskStatus.QUEUED,
      source: TaskSource.WEEKLY_PLANNING,
      isStrategic: true,
    },
    {
      title: 'Client onboarding call — Meridian Corp',
      description: 'First kickoff call with new client, review scope and timeline',
      company: Company.APERTURE_ADS,
      taskType: TaskType.DELIVERING,
      priority: 8,
      urgency: 9,
      estimatedMinutes: 60,
      energyLevel: EnergyLevel.HIGH,
      status: TaskStatus.QUEUED,
      source: TaskSource.AD_HOC,
      isReactive: true,
    },
    {
      title: 'Fix checkout flow bug on mobile Safari',
      description: 'Payment form not loading — affects ~12% of mobile users',
      company: Company.DIYP,
      taskType: TaskType.BUILDING,
      priority: 7,
      urgency: 8,
      estimatedMinutes: 120,
      energyLevel: EnergyLevel.HIGH,
      status: TaskStatus.QUEUED,
      source: TaskSource.CARRYOVER,
      carryover: true,
      carryoverCount: 1,
    },
    {
      title: 'Draft rental listing descriptions',
      description: 'Write listings for 3 new properties going live next week',
      company: Company.RENTALS,
      taskType: TaskType.PROMOTION,
      priority: 6,
      urgency: 5,
      estimatedMinutes: 60,
      energyLevel: EnergyLevel.MEDIUM,
      status: TaskStatus.BACKLOG,
      source: TaskSource.WEEKLY_PLANNING,
      isStrategic: true,
    },
    {
      title: 'DIYP landing page redesign',
      description: 'New hero section, pricing layout, social proof section',
      company: Company.DIYP,
      taskType: TaskType.BUILDING,
      priority: 8,
      urgency: 4,
      estimatedMinutes: 180,
      energyLevel: EnergyLevel.PEAK,
      status: TaskStatus.BACKLOG,
      source: TaskSource.CARRYOVER,
      carryover: true,
      carryoverCount: 2,
      isStrategic: true,
    },
    {
      title: 'Weekly team standup',
      description: 'Review deliverables with team, blockers, next steps',
      company: Company.APERTURE_ADS,
      taskType: TaskType.DELIVERING,
      priority: 5,
      urgency: 6,
      estimatedMinutes: 30,
      energyLevel: EnergyLevel.LOW,
      status: TaskStatus.QUEUED,
      source: TaskSource.WEEKLY_PLANNING,
      recurrence: 'weekly',
    },
    {
      title: 'Tenant maintenance request — unit 4B plumber',
      description: 'Coordinate plumber visit, confirm availability with tenant',
      company: Company.RENTALS,
      taskType: TaskType.DELIVERING,
      priority: 4,
      urgency: 7,
      estimatedMinutes: 30,
      energyLevel: EnergyLevel.LOW,
      status: TaskStatus.QUEUED,
      source: TaskSource.AD_HOC,
      isReactive: true,
    },
    {
      title: 'Gym — strength training',
      description: 'Upper body day',
      company: Company.PERSONAL,
      taskType: null,
      priority: 6,
      urgency: 3,
      estimatedMinutes: 60,
      energyLevel: EnergyLevel.HIGH,
      status: TaskStatus.BACKLOG,
      source: TaskSource.WEEKLY_PLANNING,
      recurrence: 'daily',
    },
    {
      title: 'Build email automation sequence',
      description: '4-email nurture for new leads: welcome, case study, offer, follow-up',
      company: Company.APERTURE_ADS,
      taskType: TaskType.PROMOTION,
      priority: 7,
      urgency: 3,
      estimatedMinutes: 120,
      energyLevel: EnergyLevel.PEAK,
      status: TaskStatus.BACKLOG,
      source: TaskSource.WEEKLY_PLANNING,
      isStrategic: true,
    },
    {
      title: 'Update rental financial tracking',
      description: 'Monthly P&L for all units, reconcile with bank statements',
      company: Company.RENTALS,
      taskType: TaskType.BUILDING,
      priority: 5,
      urgency: 4,
      estimatedMinutes: 90,
      energyLevel: EnergyLevel.MEDIUM,
      status: TaskStatus.BACKLOG,
      source: TaskSource.WEEKLY_PLANNING,
      isStrategic: true,
    },
  ];

  for (const taskData of tasks) {
    await prisma.task.create({
      data: {
        ...taskData,
        userId: user.id,
        taskType: taskData.taskType ?? undefined,
      },
    });
  }

  console.log(`Seeded ${tasks.length} tasks`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
