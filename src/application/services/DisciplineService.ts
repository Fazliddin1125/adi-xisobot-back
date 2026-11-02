import { AppError } from '../../domain/errors/AppError.js';
import type { Penalty } from '../../domain/entities/Penalty.js';
import { isOnVacation, type Role, type User } from '../../domain/entities/User.js';
import type { AppealRepository } from '../../domain/repositories/AppealRepository.js';
import type { PenaltyRepository } from '../../domain/repositories/PenaltyRepository.js';
import type { SettingsRepository } from '../../domain/repositories/SettingsRepository.js';
import type { UserRepository } from '../../domain/repositories/UserRepository.js';
import { dayKey, dayRange } from '../../shared/time.js';
import type { MessageSender } from '../ports/MessageSender.js';

/** Har kuni ish yozishi shart bo'lganlar (bo'lim boshliqlari va undan yuqorilar — yo'q) */
const REQUIRED_ROLES: Role[] = ['xodim'];
const HOUR_MS = 3_600_000;
const PENALTY_POINTS = -1;
const REMINDER_JOB = 'reminder';
const PENALTY_JOB = 'penalty';

const shortDate = (key: string) => key.split('-').reverse().join('.');

/** Toshkent devor soati: soat, daqiqa, hafta kuni (0 — yakshanba) */
function clock(now: Date) {
  const t = new Date(now.getTime() + 5 * HOUR_MS);
  return { minutes: t.getUTCHours() * 60 + t.getUTCMinutes(), weekday: t.getUTCDay() };
}

export interface PenaltySummary {
  total: number;
  items: Penalty[];
}

/**
 * Ish yozish intizomi:
 *  - 18:00 — bugun ish yozmagan xodimlarga bot eslatma yuboradi (muddat 00:00 gacha);
 *  - 00:00 dan keyin — kecha eslatma olgan va baribir yozmaganlarga -1 jarima balli;
 *  - 08:30 — jarima haqida xodimning o'ziga xabar.
 * Yakshanba va ta'til kunlari hisobga olinmaydi. Har bosqich kuniga bir marta (bazada belgilanadi).
 */
export class DisciplineService {
  constructor(
    private readonly appeals: AppealRepository,
    private readonly penalties: PenaltyRepository,
    private readonly users: UserRepository,
    private readonly settings: SettingsRepository,
    private readonly sender: MessageSender,
  ) {}

  /** Rejalashtiruvchi har daqiqa chaqiradi */
  async tick(now = new Date()): Promise<void> {
    if (!(await this.settings.get()).penaltiesEnabled) return;
    const { minutes } = clock(now);
    await this.penalizeYesterday(now);
    if (minutes >= 18 * 60 && minutes < 23 * 60 + 30) await this.remind(now);
    if (minutes >= 8 * 60 + 30 && minutes < 20 * 60) await this.notifyPenalties();
  }

  /** Bugun ish yozishi kerak bo'lgan, lekin hali yozmagan xodimlar */
  async idleOn(date: Date): Promise<User[]> {
    if (clock(date).weekday === 0) return [];
    const day = dayKey(date);
    const [users, counts] = await Promise.all([this.users.findAll(), this.appeals.countsPerStaff(dayRange(date))]);
    const wrote = new Set(counts.filter((c) => c.total > 0).map((c) => c.staffId));
    return users.filter((u) => REQUIRED_ROLES.includes(u.role) && !isOnVacation(u, day) && !wrote.has(u.id));
  }

  private async remind(now: Date): Promise<void> {
    const idle = await this.idleOn(now);
    // Yakshanba ham "bajarildi" deb belgilanadi — jarima bosqichi faqat eslatma bo'lgan kunlar uchun ishlaydi
    if (!(await this.settings.claimJob(REMINDER_JOB, dayKey(now)))) return;
    if (!this.sender.enabled || clock(now).weekday === 0) return;
    const html = [
      '⏰ <b>Bugun hali ish yozmadingiz</b>',
      '',
      'Bugun qilgan ishlaringizni <b>soat 00:00 gacha</b> yozing — shu botga oddiy xabar qilib yuborsangiz ham bo‘ladi.',
      `Yozilmasa, ertaga <b>${PENALTY_POINTS} jarima balli</b> beriladi.`,
    ].join('\n');
    let sent = 0;
    for (const u of idle.filter((u) => u.telegramId)) {
      await this.sender
        .send(u.telegramId!, html)
        .then(() => sent++)
        .catch((err) => console.error(`Eslatma yuborilmadi (${u.username}):`, (err as Error).message));
    }
    console.log(`Ish yozish eslatmasi: ${sent} ta xodimga yuborildi`);
  }

  /** Kecha eslatma yuborilgan bo'lsa (ya'ni 18:00 bosqichi ishlagan) — hali ham yozmaganlarga jarima */
  private async penalizeYesterday(now: Date): Promise<void> {
    const yesterday = new Date(dayRange(now).from.getTime() - 12 * HOUR_MS);
    const day = dayKey(yesterday);
    if (!(await this.settings.jobDone(REMINDER_JOB, day))) return;
    if (!(await this.settings.claimJob(PENALTY_JOB, day))) return;
    const idle = await this.idleOn(yesterday);
    let created = 0;
    for (const u of idle) {
      if (await this.penalties.create({ userId: u.id, day, points: PENALTY_POINTS, reason: 'Ish yozilmagan' })) created++;
    }
    console.log(`${shortDate(day)} uchun jarima: ${created} ta xodimga ${PENALTY_POINTS} ball`);
  }

  private async notifyPenalties(): Promise<void> {
    const pending = await this.penalties.listUnnotified();
    if (!pending.length) return;
    const totals = await this.penalties.totals();
    const users = new Map((await this.users.findByIds([...new Set(pending.map((p) => p.userId))])).map((u) => [u.id, u]));
    for (const p of pending) {
      if (!(await this.penalties.markNotified(p.id))) continue;
      const u = users.get(p.userId);
      if (!this.sender.enabled || !u?.telegramId) continue;
      const html = [
        `⚠️ <b>${shortDate(p.day)} kuni ish yozilmadi</b>`,
        '',
        `Sizga <b>${p.points} jarima balli</b> berildi.`,
        `Jami jarima ballaringiz: <b>${totals[p.userId] ?? p.points}</b>`,
        '',
        'Har kuni qilgan ishlaringizni yozib boring — saytda yoki shu botga xabar qilib.',
      ].join('\n');
      await this.sender.send(u.telegramId, html).catch((err) => console.error(`Jarima xabari yuborilmadi (${u.username}):`, (err as Error).message));
    }
  }

  async summary(userId: string): Promise<PenaltySummary> {
    const items = await this.penalties.listByUser(userId);
    return { total: items.reduce((s, p) => s + p.points, 0), items };
  }

  totals(): Promise<Record<string, number>> {
    return this.penalties.totals();
  }

  /** Rahbarlar: uzrli sabab bo'lsa (kasallik, bayram) jarimani bekor qilish */
  async remove(id: string): Promise<void> {
    if (!(await this.penalties.findById(id))) throw AppError.notFound('Jarima topilmadi');
    await this.penalties.delete(id);
  }
}
