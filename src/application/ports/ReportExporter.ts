import type { Appeal } from '../../domain/entities/Appeal.js';
import type { Settings } from '../../domain/entities/Settings.js';
import type { DateRange } from '../../shared/time.js';
import type { StaffStatsRow } from '../services/StatsService.js';

export interface AppealReport {
  range: DateRange;
  title: string;
  fields: Settings;
  appeals: Array<Appeal & { staffName: string; departmentName: string }>;
  staffRows: StaffStatsRow[];
}

export interface ReportExporter {
  toXlsx(report: AppealReport): Promise<Buffer>;
}
