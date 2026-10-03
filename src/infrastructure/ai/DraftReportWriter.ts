import type { ReportContent, ReportItem } from '../../domain/entities/QuarterlyReport.js';
import type { ReportWriter, ReportWriterInput, WriterEntry } from '../../application/ports/ReportWriter.js';
import { ROMAN } from '../../shared/time.js';

/** Bir xil matnli yozuvlarni bitta bandga birlashtiradi (katta-kichik harf va bo'sh joyga qaramay) */
function dedupe(entries: WriterEntry[]): ReportItem[] {
  const byText = new Map<string, ReportItem>();
  for (const e of entries) {
    const key = e.text.toLowerCase().replace(/\s+/g, ' ').trim();
    const item = byText.get(key);
    if (item) item.sources.push(e.ref);
    else byText.set(key, { text: e.text.trim(), sources: [e.ref] });
  }
  return [...byText.values()];
}

/**
 * AI ulanmagan paytdagi qoralama: yozuvlar tahrirsiz, faqat takrorlari birlashtiriladi.
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
