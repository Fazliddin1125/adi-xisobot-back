import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { ReportContent } from '../../domain/entities/QuarterlyReport.js';
import type { ReportWriter, ReportWriterInput, WriterEntry } from '../../application/ports/ReportWriter.js';
import { ROMAN } from '../../shared/time.js';

const ItemSchema = z.object({
  text: z.string().describe("Hisobotdagi bitta band: rasmiy o'zbek tilida, lotin yozuvida, majhul nisbatda"),
  sources: z.array(z.string()).describe('Shu band tuzilgan yozuvlarning ref kodlari, masalan ["I3", "I17"]'),
});

const OutputSchema = z.object({
  summary: z.string().describe("'Umumiy ma’lumot' bo'limi uchun bitta paragraf"),
  months: z.array(
    z.object({
      month: z.number().int().describe('Oy raqami (1–12)'),
      items: z.array(ItemSchema),
    }),
  ),
  extra: z.array(ItemSchema).describe("'Qo‘shimcha ishlar' — faqat T-ref'li topshiriqlardan"),
  conclusion: z.array(z.string()).describe("'Xulosa' bo'limi — 1–2 paragraf"),
});

/**
 * Tizim ko'rsatmasi o'zgarmas (keshlanadi). Uslub namunasi — bo'limning haqiqiy hisobotidan;
 * undagi faktlar ishlatilmasligi aniq aytilgan.
 */
const SYSTEM = `You write the quarterly activity report ("choraklik hisobot") of a department of the Digital Education Technologies Center (RTT markazi) at Andijan State University, Uzbekistan.

You receive the department's raw work-log entries for one quarter, grouped by month, plus tasks completed during the quarter. Staff wrote the entries quickly: in colloquial or dialect Uzbek, with typos, mixed Latin/Cyrillic, first person ("ulab berdim", "ornatdik"), and many near-duplicates. Each entry has a reference code: "I…" for work-log entries, "T…" for completed tasks.

Turn them into the official report text.

Language and style:
- Official literary Uzbek, Latin script, with the correct letters o‘ g‘ and the apostrophe ’ (e.g. "ta’minlandi", "bo‘limi").
- Impersonal passive voice, as in official reports: "…tekshirildi", "…ishchi holatga keltirildi", "…bartaraf etildi", "…o‘rnatildi", "…ulab berildi". Never first person.
- Standardize technical terms: Wi-Fi, switch, kamera, NVR, server, Kerio Control, LAN, PTZ kamera, Face ID.
- Each item is one or two complete sentences. No bullet characters, no numbering, no Markdown.

Content rules — the report is an official document, so accuracy matters more than fluency:
- Use ONLY facts present in the entries. Never invent numbers, rooms, buildings, people, equipment, or outcomes. If an entry is vague, keep it vague.
- Merge entries that describe the same kind of work into one item and cite every merged ref. When merging, you may state a count only by counting the merged entries (e.g. five separate "internet ulab berildi" entries → "5 nafar xodimning internet ulanishi ta’minlandi").
- Recurring routine work (the same check repeated many times in a month) becomes one item for that month.
- Skip entries with no work content (e.g. only a person's name, "test", empty phrases). Do not cite skipped entries.
- Keep a person's name only when the entry is clearly about that person's workplace and the name is needed to identify it; otherwise refer to the room, building, or unit.
- Order items within a month from most to least significant.
- Every item's "sources" must list only refs from the input. Work-log items go in "months" (each month only its own entries); task items ("T…") go only in "extra".
- If a month has no meaningful entries, return it with an empty items list.

Summary ("Umumiy ma’lumot"): one paragraph in the style of the example below, naming the main directions of work actually seen in the entries. Conclusion ("Xulosa"): one or two short paragraphs that summarize what was achieved, without new facts and without grand claims.

Style example — a fragment of this department's previous report. Use it ONLY for tone and phrasing; none of its facts belong in the new report:
"""
Umumiy ma’lumot: 2026-yilning II-choragi davomida bo‘lim faoliyati tasdiqlangan yillik va operativ ish rejalari asosida tashkil etildi. Hisobot davrida universitetning barcha bo‘lim va tarkibiy tuzilmalari uchun uzluksiz internet xizmati ta’minlandi, auditoriyalardagi kameralar uzluksiz ishlashi nazorat qilindi.
Bandlar:
– Switch tarmoq qurilmalari doimiy tekshirildi va aniqlangan kamchiliklar bartaraf etildi.
– Registrator ofisida nosoz hub qurilmasi o‘rniga boshqariladigan TP-Link SG3428 switch o‘rnatildi.
– 1800 o‘rinli binodagi biologiya-kimyo fakulteti tyutorlar xonasiga 15 metr tarmoq kabeli tortildi va internetga ulandi.
Xulosa: 2026-yil II-chorak davomida bo‘lim tomonidan universitetning texnik infratuzilmasi barqaror ishlashi ta’minlandi.
"""`;

function formatEntries(entries: WriterEntry[]): string {
  return entries.map((e) => `${e.ref} | ${e.date} | ${e.text.replace(/\s+/g, ' ').trim()}`).join('\n');
}

/** Claude (Anthropic API) bilan rasmiy hisobot matnini tuzadi */
export class ClaudeReportWriter implements ReportWriter {
  readonly usesAi = true;
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly name: string,
  ) {
    this.client = new Anthropic({ apiKey, timeout: 10 * 60 * 1000 });
  }

  async write(input: ReportWriterInput): Promise<ReportContent> {
    const monthBlocks = input.months
      .map((m) => `### ${m.month}-oy (${m.name}) — ${m.entries.length} ta yozuv\n${formatEntries(m.entries) || '(yozuv yo‘q)'}`)
      .join('\n\n');
    const prompt = [
      `Bo‘lim: ${input.departmentName}`,
      `Davr: ${input.year}-yil ${ROMAN[input.quarter - 1]}-chorak`,
      '',
      '## Ish yozuvlari (I…)',
      monthBlocks,
      '',
      `## Chorak davomida bajarilgan topshiriqlar (T…) — ${input.tasks.length} ta`,
      formatEntries(input.tasks) || '(yo‘q)',
    ].join('\n');

    let message;
    try {
      const stream = this.client.beta.messages.stream({
        model: this.name,
        max_tokens: 32000,
        // Rad etilsa — server o'zi mos modelda qayta bajaradi
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'high', format: betaZodOutputFormat(OutputSchema) },
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: prompt }],
      });
      message = await stream.finalMessage();
    } catch (err) {
      throw new Error(describeApiError(err));
    }

    if (message.stop_reason === 'refusal') throw new Error('AI so‘rovni rad etdi. Yozuvlarni tekshirib, qayta urinib ko‘ring.');
    if (message.stop_reason === 'max_tokens') throw new Error('Hisobot juda uzun chiqdi va kesilib qoldi. Qayta urinib ko‘ring.');
    const out = message.parsed_output;
    if (!out) throw new Error('AI javobini o‘qib bo‘lmadi. Qayta urinib ko‘ring.');

    const byMonth = new Map(out.months.map((m) => [m.month, m.items]));
    return {
      summary: out.summary,
      // Oylar tartibi va nomlari kirishdan olinadi — AI faqat bandlarni beradi
      months: input.months.map((m) => ({ month: m.month, name: m.name, items: byMonth.get(m.month) ?? [] })),
      extra: out.extra,
      conclusion: out.conclusion,
    };
  }
}

function describeApiError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'Anthropic API kaliti noto‘g‘ri yoki bekor qilingan.';
  if (err instanceof Anthropic.PermissionDeniedError) return 'Anthropic API kaliti bu modeldan foydalanishga ruxsat bermaydi.';
  if (err instanceof Anthropic.RateLimitError) return 'Anthropic API so‘rovlar limiti tugadi. Birozdan keyin urinib ko‘ring.';
  if (err instanceof Anthropic.BadRequestError) return `Anthropic API so‘rovni qabul qilmadi: ${err.message}`;
  if (err instanceof Anthropic.APIError) return `Anthropic API xatosi (${err.status ?? 'tarmoq'}): ${err.message}`;
  return `AI bilan bog‘lanib bo‘lmadi: ${(err as Error).message}`;
}
