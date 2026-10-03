import type { ReportContent } from '../../domain/entities/QuarterlyReport.js';

/** AI'ga yuboriladigan bitta yozuv. Xodim ismi yuborilmaydi — faqat ish matni */
export interface WriterEntry {
  ref: string;
  date: string; // "2026-05-13"
  text: string;
}

export interface ReportWriterInput {
  departmentName: string;
  year: number;
  quarter: number;
  months: Array<{ month: number; name: string; entries: WriterEntry[] }>;
  /** Chorak davomida bajarilgan topshiriqlar → "Qo'shimcha ishlar" */
  tasks: WriterEntry[];
}

/** Xom yozuvlardan rasmiy hisobot matnini tuzadi (Claude yoki AI'siz qoralama) */
export interface ReportWriter {
  /** Hisobotda saqlanadigan nom: model ID yoki "qoralama" */
  readonly name: string;
  readonly usesAi: boolean;
  write(input: ReportWriterInput): Promise<ReportContent>;
}
