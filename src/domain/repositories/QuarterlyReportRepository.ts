import type { QuarterlyReport } from '../entities/QuarterlyReport.js';

export type NewQuarterlyReport = Omit<QuarterlyReport, 'id' | 'createdAt' | 'updatedAt'>;
export type QuarterlyReportChanges = Partial<Omit<QuarterlyReport, 'id' | 'departmentId' | 'year' | 'quarter' | 'createdAt' | 'updatedAt'>>;

export interface QuarterlyReportRepository {
  findById(id: string): Promise<QuarterlyReport | null>;
  find(departmentId: string, year: number, quarter: number): Promise<QuarterlyReport | null>;
  /** Eng oxirgi tayyor hisobot — tasdiq qatorini (markaz boshlig'i) qayta ishlatish uchun */
  findLatestReady(): Promise<QuarterlyReport | null>;
  create(data: NewQuarterlyReport): Promise<QuarterlyReport>;
  update(id: string, changes: QuarterlyReportChanges): Promise<QuarterlyReport | null>;
}
