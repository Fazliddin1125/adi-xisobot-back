import { AppError } from '../../domain/errors/AppError.js';
import type { Task, TaskStatus } from '../../domain/entities/Task.js';
import { isOnVacation, type Role, type User } from '../../domain/entities/User.js';
import type { AppealRepository } from '../../domain/repositories/AppealRepository.js';
import type { DepartmentRepository } from '../../domain/repositories/DepartmentRepository.js';
import type { SettingsRepository } from '../../domain/repositories/SettingsRepository.js';
import type { TaskRepository } from '../../domain/repositories/TaskRepository.js';
import type { UserRepository } from '../../domain/repositories/UserRepository.js';
import { dayKey, dayRange } from '../../shared/time.js';
import type { MessageSender } from '../ports/MessageSender.js';

/** "Ish yozganlar" ro'yxatiga kiradigan rollar (markaz boshlig'i va superadmin kirmaydi) */
const STAFF_ROLES: Role[] = ['xodim', 'bolim_boshligi'];
/** "Ish yozmaganlar" — faqat xodimlar: bo'lim boshliqlari har kuni ish yozishi shart emas */
const IDLE_ROLES: Role[] = ['xodim'];
/** Hisobot boradiganlar */
const RECIPIENT_ROLES: Role[] = ['bolim_boshligi'];
const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const STATUS_LABEL: Record<TaskStatus, string> = { yangi: '🆕 Yangi', jarayonda: '🔄 Jarayonda', bajarildi: '✅ Bajarildi' };
/** Telegram xabari 4096 belgigacha — zaxira bilan */
const MESSAGE_LIMIT = 3800;

interface PersonRow {
  id: string;
  fullName: string;
  departmentName: string;
  /** Bugun yozgan ishlari */
  appeals: number;
  /** Bugun "Bajarildi"ga o'tkazgan topshiriqlari */
  tasksDone: number;
}

export interface DailyReport {
  day: string; // "YYYY-MM-DD"
  newTasks: Array<{ id: string; title: string; status: TaskStatus; assignees: string[]; completedBy?: string }>;
  completedTasks: Array<{ id: string; title: string; completedBy?: string }>;
  totalAppeals: number;
  /** Bugun ish yozganlar — ko'pidan kamiga */
  active: PersonRow[];
  /** Bugun bitta ham ish yozmagan xodimlar (ta'tildagilar va bo'lim boshliqlaridan tashqari) */
  idle: PersonRow[];
  onVacation: Array<{ fullName: string; departmentName: string; until: string }>;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const shortDate = (key: string) => key.split('-').reverse().join('.');
const short = (fullName: string) => fullName.split(/\s+/).slice(0, 2).join(' ');

export class DailyReportService {
  constructor(
    private readonly appeals: AppealRepository,
    private readonly tasks: TaskRepository,
    private readonly users: UserRepository,
    private readonly departments: DepartmentRepository,
    private readonly settings: SettingsRepository,
    private readonly sender: MessageSender,
  ) {}

  async build(date = new Date()): Promise<DailyReport> {
    const range = dayRange(date);
    const day = dayKey(date);
    const [users, departments, counts, created, completed] = await Promise.all([
      this.users.findAll(),
      this.departments.findAll(),
      this.appeals.countsPerStaff(range),
      this.tasks.listCreated(range),
      this.tasks.listCompletedBetween(range),
    ]);
    const names = new Map(users.map((u) => [u.id, u.fullName]));
    const deptName = new Map(departments.map((d) => [d.id, d.name]));
    const appealsOf = new Map(counts.map((c) => [c.staffId, c.total]));
    const doneBy = new Map<string, number>();
    for (const t of completed) if (t.completedById) doneBy.set(t.completedById, (doneBy.get(t.completedById) ?? 0) + 1);

    const row = (u: User): PersonRow => ({
      id: u.id,
      fullName: u.fullName,
      departmentName: (u.departmentId && deptName.get(u.departmentId)) || "Bo'limsiz",
      appeals: appealsOf.get(u.id) ?? 0,
      tasksDone: doneBy.get(u.id) ?? 0,
    });
    const staff = users.filter((u) => STAFF_ROLES.includes(u.role));
    const working = staff.filter((u) => !isOnVacation(u, day));
    const byName = (a: { fullName: string }, b: { fullName: string }) => a.fullName.localeCompare(b.fullName);
    const nameOf = (id?: string) => (id ? names.get(id) : undefined);
    const toTaskRow = (t: Task) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      assignees: t.assigneeIds.map((a) => names.get(a) ?? '—'),
      completedBy: nameOf(t.completedById),
    });

    return {
      day,
      newTasks: created.map(toTaskRow),
      completedTasks: completed.map((t) => ({ id: t.id, title: t.title, completedBy: nameOf(t.completedById) })),
      totalAppeals: counts.reduce((sum, c) => sum + c.total, 0),
      active: working
        .map(row)
        .filter((r) => r.appeals > 0)
        .sort((a, b) => b.appeals - a.appeals || byName(a, b)),
      idle: working
        .filter((u) => IDLE_ROLES.includes(u.role))
        .map(row)
        .filter((r) => r.appeals === 0)
        .sort(byName),
      onVacation: staff
        .filter((u) => isOnVacation(u, day))
        .map((u) => ({ ...row(u), until: u.vacationTo! }))
        .sort(byName),
    };
  }

  /** Telegram HTML; uzun bo'lsa bir nechta xabarga bo'linadi */
  format(r: DailyReport): string[] {
    const weekday = WEEKDAYS[new Date(`${r.day}T12:00:00+05:00`).getUTCDay()];
    const lines: string[] = [`📊 <b>Kunlik hisobot · ${shortDate(r.day)}, ${weekday}</b>`, ''];

    lines.push(`📌 <b>Bugun berilgan topshiriqlar: ${r.newTasks.length}</b>`);
    for (const t of r.newTasks) {
      const who = t.status === 'bajarildi' && t.completedBy ? `bajardi: ${short(t.completedBy)}` : t.assignees.length ? t.assignees.map(short).join(', ') : 'umumiy ish';
      lines.push(`• ${escapeHtml(t.title)} — ${STATUS_LABEL[t.status]} · ${escapeHtml(who)}`);
    }

    const doneElsewhere = r.completedTasks.filter((t) => !r.newTasks.some((n) => n.id === t.id));
    if (doneElsewhere.length) {
      lines.push('', `✅ <b>Bugun bajarilgan (avvalgi) topshiriqlar: ${doneElsewhere.length}</b>`);
      for (const t of doneElsewhere) lines.push(`• ${escapeHtml(t.title)}${t.completedBy ? ` — ${escapeHtml(short(t.completedBy))}` : ''}`);
    }

    lines.push('', `📝 <b>Ishlar: jami ${r.totalAppeals} ta, ${r.active.length} kishi</b>`);
    r.active.forEach((p, i) => {
      const extra = p.tasksDone ? `, ${p.tasksDone} topshiriq` : '';
      lines.push(`${i + 1}. ${escapeHtml(short(p.fullName))} — <b>${p.appeals}</b> ta${extra}`);
    });

    lines.push('', `⚠️ <b>Bugun ish yozmaganlar: ${r.idle.length}</b>`);
    if (!r.idle.length) lines.push('Hamma ish yozgan 👏');
    r.idle.forEach((p, i) => lines.push(`${i + 1}. ${escapeHtml(short(p.fullName))}${p.tasksDone ? ` (${p.tasksDone} topshiriq bajardi)` : ''}`));

    if (r.onVacation.length) {
      lines.push('', `🌴 <b>Ta'tilda: ${r.onVacation.length}</b>`);
      r.onVacation.forEach((p, i) => lines.push(`${i + 1}. ${escapeHtml(short(p.fullName))} (${shortDate(p.until)} gacha)`));
    }

    return chunk(lines, MESSAGE_LIMIT);
  }

  /** Bo'lim boshliqlariga yuborish. Natija: nechta kishiga yetib bordi */
  async sendToHeads(date = new Date()): Promise<number> {
    if (!this.sender.enabled) return 0;
    const messages = this.format(await this.build(date));
    const heads = (await this.users.findAll()).filter((u) => RECIPIENT_ROLES.includes(u.role) && u.telegramId);
    let delivered = 0;
    for (const u of heads) {
      try {
        for (const m of messages) await this.sender.send(u.telegramId!, m);
        delivered++;
      } catch (err) {
        console.error(`Kunlik hisobot yuborilmadi (${u.username}):`, (err as Error).message);
      }
    }
    return delivered;
  }

  /**
   * Rejalashtiruvchi har daqiqa chaqiradi: 18:00–21:00 (Toshkent) oralig'ida, yakshanbadan tashqari,
   * kuniga bir marta yuboradi. Server qayta ishga tushsa ham takrorlanmaydi (bazada belgilanadi).
   */
  async tick(now = new Date()): Promise<void> {
    const tashkent = new Date(now.getTime() + 5 * 3_600_000);
    const hour = tashkent.getUTCHours();
    if (hour < 18 || hour >= 21 || tashkent.getUTCDay() === 0) return;
    if (!this.sender.enabled || !(await this.settings.get()).dailyReportEnabled) return;
    if (!(await this.settings.claimDailyReport(dayKey(now)))) return;
    const delivered = await this.sendToHeads(now);
    console.log(`Kunlik hisobot yuborildi: ${delivered} ta bo'lim boshlig'iga`);
  }

  /** Superadmin: hozirgi holat bo'yicha hisobotni o'ziga sinov uchun yuborish */
  async sendTest(userId: string): Promise<void> {
    if (!this.sender.enabled) throw AppError.badRequest('Telegram bot sozlanmagan (TELEGRAM_BOT_TOKEN yo\'q)');
    const user = await this.users.findById(userId);
    if (!user?.telegramId) throw AppError.badRequest('Profilingizga Telegram ID kiritilmagan');
    for (const m of this.format(await this.build())) await this.sender.send(user.telegramId, m);
  }
}

/** Qatorlarni buzmasdan limitgacha bo'lib chiqadi */
function chunk(lines: string[], limit: number): string[] {
  const out: string[] = [];
  let current = '';
  for (const line of lines) {
    const piece = line.length > limit ? `${line.slice(0, limit - 1)}…` : line;
    if (current && current.length + piece.length + 1 > limit) {
      out.push(current);
      current = piece;
    } else current = current ? `${current}\n${piece}` : piece;
  }
  if (current) out.push(current);
  return out;
}
