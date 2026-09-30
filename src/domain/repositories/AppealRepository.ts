import type { Appeal, AppealChanges, AppealStatus, Channel, NewAppeal, VisitorType } from '../entities/Appeal.js';

export interface AppealFilter {
  from: Date;
  to: Date;
  /** Berilsa — faqat shu xodimlarning murojaatlari */
  staffIds?: string[];
}

export interface AppealBreakdown {
  total: number;
  byChannel: Record<Channel, number>;
  byVisitorType: Record<VisitorType, number>;
  byStatus: Record<AppealStatus, number>;
  /** Toshkent bo'yicha "YYYY-MM-DD" → soni */
  daily: Record<string, number>;
}

export interface StaffCounts {
  staffId: string;
  total: number;
  offline: number;
  online: number;
  resolved: number;
}

export interface AppealRepository {
  create(data: NewAppeal): Promise<Appeal>;
  findById(id: string): Promise<Appeal | null>;
  update(id: string, changes: AppealChanges): Promise<Appeal | null>;
  delete(id: string): Promise<void>;
  list(filter: AppealFilter): Promise<Appeal[]>;
  count(filter: AppealFilter): Promise<number>;
  countByStaff(staffId: string): Promise<number>;
  breakdown(filter: AppealFilter): Promise<AppealBreakdown>;
  countsPerStaff(filter: AppealFilter): Promise<StaffCounts[]>;
}
