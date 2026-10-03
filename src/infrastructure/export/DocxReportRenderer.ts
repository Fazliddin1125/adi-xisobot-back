import { readFile } from 'node:fs/promises';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import type { ReportRenderer } from '../../application/ports/ReportRenderer.js';
import type { QuarterlyReport } from '../../domain/entities/QuarterlyReport.js';
import { ROMAN } from '../../shared/time.js';

/**
 * Word shabloni (templates/chorak-hisoboti.docx) ni to'ldiradi.
 * Shablon bo'limning asl hisobotidan olingan formatda — uni Word'da tahrirlash mumkin,
 * faqat {o'rinbosarlar} va {#sikl}...{/sikl} paragraflari saqlanishi kerak.
 */
export class DocxReportRenderer implements ReportRenderer {
  constructor(private readonly templatePath: string) {}

  async toDocx(report: QuarterlyReport & { content: NonNullable<QuarterlyReport['content']> }): Promise<Buffer> {
    const zip = new PizZip(await readFile(this.templatePath));
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => '' });
    const { header: h, content: c } = report;
    doc.render({
      tasdiq_lavozim: h.approverTitle,
      tasdiq_ism: h.approverName,
      markaz_nomi: h.centerName,
      bolim_nomi: h.departmentName,
      imzo_lavozim: h.signerTitle,
      imzo_ism: h.signerName,
      yil: report.year,
      chorak_rim: ROMAN[report.quarter - 1],
      umumiy: c.summary,
      // Ishi yo'q oylar Word'ga chiqmaydi, qolganlari qayta raqamlanadi
      oylar: c.months
        .filter((m) => m.items.length > 0)
        .map((m, i) => ({ raqam: i + 1, nomi: m.name, bandlar: m.items.map((it) => ({ matn: it.text })) })),
      qoshimcha_bor: c.extra.length > 0,
      qoshimcha: c.extra.map((it) => ({ matn: it.text })),
      xulosa: c.conclusion,
    });
    return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  }
}
