import { AppError } from '../../domain/errors/AppError.js';
import type {
  QuarterlyReport,
  ReportContent,
  ReportHeader,
  ReportItem,
  ReportSource,
} from '../../domain/entities/QuarterlyReport.js';
import type { User } from '../../domain/entities/User.js';
import type { AppealRepository } from '../../domain/repositories/AppealRepository.js';
import type { DepartmentRepository } from '../../domain/repositories/DepartmentRepository.js';
import type { QuarterlyReportRepository } from '../../domain/repositories/QuarterlyReportRepository.js';
import type { TaskRepository } from '../../domain/repositories/TaskRepository.js';
import type { UserRepository } from '../../domain/repositories/UserRepository.js';
import type { SettingsRepository } from '../../domain/repositories/SettingsRepository.js';
import { MONTH_NAMES, dayKey, monthOf, quarterMonths, quarterRange } from '../../shared/time.js';
import type { Actor } from '../Actor.js';
import type { ReportRenderer } from '../ports/ReportRenderer.js';
import type { ReportWriter, WriterEntry } from '../ports/ReportWriter.js';

/** Bu vaqtdan uzoq "tayyorlanmoqda" turgan hisobot osilib qolgan hisoblanadi */
const STALE_GENERATION_MS = 15 * 60 * 1000;

const DEFAULT_HEADER = {
  approverTitle: 'RTT Markazi boshlig‘i',
  centerName: 'Raqamli ta’lim texnologiyalari markazi',
};

/** Klaviaturadagi ' va ` belgilarini o'zbekcha o‘/g‘ uchun to'g'ri ‘ ga almashtiradi */
const fixApostrophe = (s: string) => s.replace(/(?<=[OoGg])['`ʻʼ’]/g, '‘').replace(/['`ʻʼ]/g, '’');

/** "Jo'rayev Muhammad Davronovich" → "M.D.Jo‘rayev" (o'zbekcha Sh/Ch/O‘/G‘ bitta harf hisoblanadi) */
export function shortName(fullName: string): string {
  const fix = fixApostrophe;
  const [surname, ...rest] = fullName.trim().split(/\s+/).map(fix);
  if (!surname) return '';
  const initial = (w: string) => (/^(Sh|Ch|O‘|G‘)/i.exec(w)?.[0] ?? w[0]).replace(/^./, (c) => c.toUpperCase()) + '.';
  return rest.map(initial).join('') + surname;
}

export class QuarterlyReportService {
  constructor(
    private readonly reports: QuarterlyReportRepository,
    private readonly appeals: AppealRepository,
    private readonly tasks: TaskRepository,
    private readonly users: UserRepository,
    private readonly departments: DepartmentRepository,
    private readonly writer: ReportWriter,
    private readonly renderer: ReportRenderer,
    private readonly settings: SettingsRepository,
  ) {}

  /** AI ulanganmi va joriy foydalanuvchi hisobot tayyorlay oladimi */
  async aiStatus(actor: Actor) {
    return { enabled: this.writer.usesAi, writer: this.writer.name, canGenerate: await this.canGenerate(actor) };
  }

  /** Superadmin o'chirib qo'ysa, faqat superadminning o'zi tayyorlay oladi (token sarfini nazorat qilish) */
  private async canGenerate(actor: Actor): Promise<boolean> {
    return actor.role === 'superadmin' || (await this.settings.get()).reportGenerationEnabled;
  }

  async get(departmentId: string, year: number, quarter: number): Promise<QuarterlyReport | null> {
    return this.reports.find(departmentId, year, quarter);
  }

  /**
   * Hisobotni (qayta) tayyorlashni boshlaydi va darhol qaytadi.
   * Matn fonda yoziladi (AI 1–2 daqiqa olishi mumkin) — frontend holatni so'rab turadi.
   */
  async generate(actor: Actor, departmentId: string, year: number, quarter: number): Promise<QuarterlyReport> {
    if (!(await this.canGenerate(actor))) {
      throw AppError.forbidden('Hisobot tayyorlash superadmin tomonidan vaqtincha o‘chirilgan. Tayyor hisobotlarni ko‘rish va yuklash mumkin.');
    }
    const department = await this.departments.findById(departmentId);
    if (!department) throw AppError.notFound('Bo‘lim topilmadi');

    const existing = await this.reports.find(departmentId, year, quarter);
    if (existing?.status === 'generating' && Date.now() - existing.updatedAt.getTime() < STALE_GENERATION_MS) {
      throw AppError.conflict('Bu hisobot hozir tayyorlanmoqda, biroz kuting');
    }

    const staff = await this.users.findAll({ departmentId });
    const { sources, months, tasks } = await this.collect(staff, year, quarter);
    if (!sources.length) {
      throw AppError.badRequest(`Bu chorakda "${department.name}" xodimlari hech qanday ish yoki topshiriq qayd etmagan`);
    }

    const header = existing?.header ?? (await this.defaultHeader(fixApostrophe(department.name), staff));
    const base = { status: 'generating' as const, sources, generatedById: actor.id, writer: this.writer.name, error: undefined };
    const report = existing
      ? (await this.reports.update(existing.id, base))!
      : await this.reports.create({ ...base, departmentId, year, quarter, header });

    void this.runWriter(report.id, { departmentName: header.departmentName || department.name, year, quarter, months, tasks }, sources);
    return report;
  }

  /** Ko'rib chiqish sahifasidagi tahrirlar */
  async update(id: string, changes: { header?: ReportHeader; content?: ReportContent }): Promise<QuarterlyReport> {
    const report = await this.reports.findById(id);
    if (!report) throw AppError.notFound('Hisobot topilmadi');
    if (report.status === 'generating') throw AppError.conflict('Hisobot hali tayyorlanmoqda');
    if (changes.content && !report.content) throw AppError.badRequest('Hisobot hali yozilmagan');
    return (await this.reports.update(id, changes))!;
  }

  async docx(id: string): Promise<{ filename: string; buffer: Buffer }> {
    const report = await this.reports.findById(id);
    if (!report?.content) throw AppError.notFound('Tayyor hisobot topilmadi');
    const buffer = await this.renderer.toDocx({ ...report, content: report.content });
    const dept = (report.header.departmentName || 'bolim').replace(/[^A-Za-z0-9‘’']+/g, '-').replace(/^-|-$/g, '');
    return { filename: `${dept}-${report.year}-${report.quarter}-chorak-hisoboti.docx`, buffer };
  }

  /** Bo'lim xodimlarining chorakdagi ishlari va bajargan topshiriqlari, ref kodlari bilan */
  private async collect(staff: User[], year: number, quarter: number) {
    const range = quarterRange(year, quarter);
    const staffIds = staff.map((u) => u.id);
    const names = new Map(staff.map((u) => [u.id, u.fullName]));
    const [appeals, tasks] = staffIds.length
      ? await Promise.all([this.appeals.list({ ...range, staffIds }), this.tasks.listCompleted({ ...range, assigneeIds: staffIds })])
      : [[], []];

    const sources: ReportSource[] = [];
    const byMonth = new Map<number, WriterEntry[]>(quarterMonths(quarter).map((m) => [m, []]));
    [...appeals]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .forEach((a, i) => {
        const ref = `I${i + 1}`;
        const text = a.comment ? `${a.title} — ${a.comment}` : a.title;
        sources.push({ ref, kind: 'ish', date: a.createdAt, text, author: names.get(a.staffId) ?? '—' });
        byMonth.get(monthOf(a.createdAt))?.push({ ref, date: dayKey(a.createdAt), text });
      });

    const taskEntries: WriterEntry[] = tasks.map((t, i) => {
      const ref = `T${i + 1}`;
      const date = t.completedAt ?? t.updatedAt;
      const text = t.description ? `${t.title} — ${t.description.slice(0, 400)}` : t.title;
      const doers = t.assigneeIds.map((id) => names.get(id)).filter(Boolean).join(', ');
      sources.push({ ref, kind: 'topshiriq', date, text, author: doers || '—' });
      return { ref, date: dayKey(date), text };
    });

    const months = quarterMonths(quarter).map((m) => ({ month: m, name: MONTH_NAMES[m - 1], entries: byMonth.get(m) ?? [] }));
    return { sources, months, tasks: taskEntries };
  }

  private async defaultHeader(departmentName: string, staff: User[]): Promise<ReportHeader> {
    // Tasdiq qatori (markaz boshlig'i) — oldingi hisobotdan yoki tizimdagi markaz boshlig'idan
    const previous = await this.reports.findLatestReady();
    const director = previous ? null : (await this.users.findAll()).find((u) => u.role === 'markaz_boshligi');
    const head = staff.find((u) => u.role === 'bolim_boshligi');
    return {
      approverTitle: previous?.header.approverTitle || DEFAULT_HEADER.approverTitle,
      approverName: previous?.header.approverName || (director ? shortName(director.fullName) : ''),
      centerName: previous?.header.centerName || DEFAULT_HEADER.centerName,
      departmentName,
      signerTitle: `${departmentName} boshlig‘i`,
      signerName: head ? shortName(head.fullName) : '',
    };
  }

  private async runWriter(id: string, input: Parameters<ReportWriter['write']>[0], sources: ReportSource[]) {
    try {
      const content = sanitize(await this.writer.write(input), sources);
      await this.reports.update(id, { status: 'ready', content, writer: this.writer.name, generatedAt: new Date(), error: undefined });
    } catch (err) {
      console.error('Hisobot yozilmadi:', err);
      await this.reports.update(id, { status: 'failed', error: (err as Error).message }).catch(() => undefined);
    }
  }
}

/**
 * AI javobini tekshiradi: mavjud bo'lmagan ref'lar olib tashlanadi, manbasiz bandlar chiqarib tashlanadi.
 * Ish bandlari faqat I-ref, qo'shimcha ishlar faqat T-ref bilan bo'lishi kerak.
 */
function sanitize(content: ReportContent, sources: ReportSource[]): ReportContent {
  const known = new Set(sources.map((s) => s.ref));
  const clean = (items: ReportItem[], prefix: 'I' | 'T') =>
    items
      .map((it) => ({ text: it.text.trim(), sources: [...new Set(it.sources)].filter((r) => known.has(r) && r.startsWith(prefix)) }))
      .filter((it) => it.text && it.sources.length > 0);
  return {
    summary: content.summary.trim(),
    months: content.months.map((m) => ({ ...m, items: clean(m.items, 'I') })),
    extra: clean(content.extra, 'T'),
    conclusion: content.conclusion.map((p) => p.trim()).filter(Boolean),
  };
}
