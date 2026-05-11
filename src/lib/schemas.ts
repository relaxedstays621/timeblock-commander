import { z } from 'zod';

export const CompanyEnum = z.enum([
  'APERTURE_ADS',
  'RENTALS',
  'DIYP',
  'PERSONAL',
]);

export const TaskTypeEnum = z.enum(['PROMOTION', 'DELIVERING', 'BUILDING']);

export const EnergyLevelEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'PEAK']);

// 'SCHEDULED' is intentionally excluded from the input enum as of item 03
// of the daily-planning scope. "Scheduled" is a derived flag computed at
// read time from blocks-this-week; it must not be settable via task create
// or update. The Prisma TaskStatus enum still carries SCHEDULED so legacy
// rows continue to read correctly, but no API call can write that value.
export const TaskStatusEnum = z.enum([
  'BACKLOG',
  'QUEUED',
  'IN_PROGRESS',
  'COMPLETE',
  'DEFERRED',
  'DROPPED',
]);

export const TaskSourceEnum = z.enum([
  'INTAKE_CHAT',
  'QUICK_CAPTURE',
  'WEEKLY_PLANNING',
  'CARRYOVER',
  'AD_HOC',
  'VOICE_NOTE',
  'N8N_WEBHOOK',
]);

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  company: CompanyEnum,
  taskType: TaskTypeEnum.optional(),
  priority: z.number().int().min(1).max(10).default(5),
  urgency: z.number().int().min(1).max(10).default(5),
  estimatedMinutes: z.number().int().min(5).max(480).default(60),
  dueDate: z.string().datetime().nullable().optional(),
  recurrence: z.string().max(50).optional(),
  energyLevel: EnergyLevelEnum.default('MEDIUM'),
  status: TaskStatusEnum.default('BACKLOG'),
  source: TaskSourceEnum.default('QUICK_CAPTURE'),
  isStrategic: z.boolean().default(false),
  isReactive: z.boolean().default(false),
  // Item-04 pin override: score = 100, claims prime hours. Item-05
  // mustBeDoneToday: forces today placement (item 05 owns the placement
  // logic; the field accepts here so the capture form can set it).
  userPinned: z.boolean().default(false),
  mustBeDoneToday: z.boolean().default(false),
});

export const UpdateTaskSchema = CreateTaskSchema.partial().extend({
  carryover: z.boolean().optional(),
  completedAt: z.string().datetime().nullable().optional(),
});

export const QuickCaptureSchema = z.object({
  title: z.string().min(1).max(200),
  company: CompanyEnum,
  taskType: TaskTypeEnum.optional(),
  urgency: z.number().int().min(1).max(10).default(5),
  context: z.string().max(500).optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type QuickCaptureInput = z.infer<typeof QuickCaptureSchema>;
