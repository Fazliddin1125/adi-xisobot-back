import type { ReportContent, ReportItem } from '../../domain/entities/QuarterlyReport.js';
import type { ReportWriter, ReportWriterInput, WriterEntry } from '../../application/ports/ReportWriter.js';
import { ROMAN } from '../../shared/time.js';

/**
 * Faqat haqiqiy dublikatlarni birlashtiradi: bir kunda bir xil matn bilan kiritilgan yozuvlar.
 * Turli kunlarda qilingan bir xil ish — alohida ish, alohida band bo'lib qoladi.
 */
function dedupe(entries: WriterEntry[]): ReportItem[] {
  const byText = new Map<string, ReportItem>();
  for (const e of entries) {
    const key = `${e.date}|${e.text.toLowerCase().replace(/\s+/g, ' ').trim()}`;
    const item = byText.get(key);
    if (item) item.sources.push(e.ref);
    else byText.set(key, { text: e.text.trim(), sources: [e.ref] });
  }
  return [...byText.values()];
}

/**
 * AI ulanmagan paytdagi qoralama: yozuvlar tahrirsiz, faqat bir kundagi dublikatlar birlashtiriladi.
 * Rahbar ko'rib chiqish sahifasida matnni o'zi tahrirlaydi.
 */
export class DraftReportWriter implements ReportWriter {
  readonly name = 'qoralama';
  readonly usesAi = false;

  async write(input: ReportWriterInput): Promise<ReportContent> {
    const period = `${input.year}-yilning ${ROMAN[input.quarter - 1]}-choragi`;
    return {
      summary: `${period} davomida bo‘lim faoliyati tasdiqlangan yillik va operativ ish rejalari asosida tashkil etildi.`,
      months: input.months.map((m) => ({ month: m.month, name: m.name, items: dedupe(m.entries) })),
      extra: dedupe(input.tasks),
      conclusion: [`${period} davomida ${input.departmentName} tomonidan belgilangan vazifalar bajarildi.`],
    };
  }
}
