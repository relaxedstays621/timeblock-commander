import { Company, TaskType } from '@prisma/client';

export const COMPANY_DISPLAY: Record<Company, string> = {
  APERTURE_ADS: 'Aperture Ads',
  RENTALS: 'Rentals',
  DIYP: 'DIYP',
  PERSONAL: 'Personal',
};

export const COMPANY_COLORS: Record<Company, { accent: string; bg: string }> = {
  APERTURE_ADS: { accent: '#e94560', bg: 'rgba(233,69,96,0.12)' },
  RENTALS: { accent: '#16a085', bg: 'rgba(22,160,133,0.12)' },
  DIYP: { accent: '#0096FF', bg: 'rgba(243,156,18,0.12)' },
  PERSONAL: { accent: '#7c8cf8', bg: 'rgba(124,140,248,0.12)' },
};

export const TASK_TYPE_DISPLAY: Record<TaskType, { label: string; icon: string }> = {
  PROMOTION: { label: 'Promotion', icon: '📣' },
  DELIVERING: { label: 'Delivering', icon: '🤝' },
  BUILDING: { label: 'Building', icon: '🔧' },
};

export const COMPANIES = Object.values(Company) as Company[];
export const TASK_TYPES = Object.values(TaskType) as TaskType[];

export const HOURS = Array.from({ length: 15 }, (_, i) => i + 6); // 6am-8pm
