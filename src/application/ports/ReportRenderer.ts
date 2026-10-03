import type { QuarterlyReport } from '../../domain/entities/QuarterlyReport.js';

/** Tayyor hisobotni Word (.docx) faylga aylantiradi */
export interface ReportRenderer {
  toDocx(report: QuarterlyReport & { content: NonNullable<QuarterlyReport['content']> }): Promise<Buffer>;
}
