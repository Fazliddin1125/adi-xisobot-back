import { AppError } from '../../domain/errors/AppError.js';
import type { Penalty } from '../../domain/entities/Penalty.js';
import { isOnVacation, type Role, type User } from '../../domain/entities/User.js';
import type { AppealRepository } from '../../domain/repositories/AppealRepository.js';
import type { PenaltyRepository } from '../../domain/repositories/PenaltyRepository.js';
import type { SettingsRepository } from '../../domain/repositories/SettingsRepository.js';
import type { UserRepository } from '../../domain/repositories/UserRepository.js';
import { dayKey, dayRange } from '../../shared/time.js';
import type { DeliveryLog } from '../../domain/entities/Delivery.js';
import type { BotDeliveryService } from './BotDeliveryService.js';

/** Har kuni ish yozishi shart bo'lganlar (bo'lim boshliqlari va undan yuqorilar — yo'q) */
const REQUIRED_ROLES: Role[] = ['xodim'];
const HOUR_MS = 3_600_000;
const PENALTY_POINTS = -1;
const REMINDER_JOB = 'reminder';
const PENALTY_JOB = 'penalty';

const shortDate = (key: string) => key.split('-').reverse().join('.');
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Bot "write" tugmasini ushlaydi va ish yozishni so'raydi */
const WRITE_BUTTON = [[{ text: '✍️ Ish yozish', callback_data: 'write' }]];
/** Jarima eslatmasi matni — har bir eslatmada */
const PENALTY_NOTE = `00:00 gacha ish yozilmasa, <b>${PENALTY_POINTS} jarima balli</b> beriladi.`;

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
    private readonly delivery: BotDeliveryService,
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
    if (!this.delivery.enabled || clock(now).weekday === 0) return;
    const html = [
      '⏰ <b>Bugun hali ish yozmadingiz</b>',
      '',
      'Bugun qilgan ishlaringizni <b>soat 00:00 gacha</b> yozing — pastdagi tugmani bosing yoki shu botga oddiy xabar qilib yuboring.',
      PENALTY_NOTE,
    ].join('\n');
    await this.delivery.sendBatch('eslatma', `18:00 eslatma · ${shortDate(dayKey(now))}`, idle, html, { buttons: WRITE_BUTTON });
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
    if (!pending.length || !this.delivery.enabled) return;
    // Faqat shu chaqiruv belgilagan jarimalar (ikki marta yubormaslik uchun)
    const mine = [];
    for (const p of pending) if (await this.penalties.markNotified(p.id)) mine.push(p);
    if (!mine.length) return;
    const totals = await this.penalties.totals();
    const days = new Map<string, string[]>();
    for (const p of mine) days.set(p.userId, [...(days.get(p.userId) ?? []), shortDate(p.day)]);
    const users = await this.users.findByIds([...days.keys()]);
    const message = (u: User) => {
      const list = days.get(u.id)!;
      return [
        `⚠️ <b>${list.join(', ')} kuni ish yozilmadi</b>`,
        '',
        `Sizga <b>${list.length * PENALTY_POINTS} jarima balli</b> berildi.`,
        `Jami jarima ballaringiz: <b>${totals[u.id] ?? list.length * PENALTY_POINTS}</b>`,
        '',
        'Har kuni qilgan ishlaringizni yozib boring — saytda yoki shu botga xabar qilib.',
      ].join('\n');
    };
    await this.delivery.sendBatch('jarima', `Jarima xabari · ${[...new Set(mine.map((p) => shortDate(p.day)))].join(', ')}`, users, message, {
      buttons: WRITE_BUTTON,
    });
  }

  /**
   * Rahbar saytdan: "qilgan ishlaringizni botga yozing" eslatmasi.
   * onlyIdle — faqat bugun hali ish yozmaganlarga. Faqat xodimlarga (bo'lim boshliqlariga emas).
   * Natija: kimga yetib bordi, kimga bormadi (sababi bilan)
   */
  async broadcastReminder(actorId: string, onlyIdle: boolean): Promise<DeliveryLog | null> {
    if (!this.delivery.enabled) throw AppError.badRequest('Telegram bot sozlanmagan (TELEGRAM_BOT_TOKEN yo\'q)');
    const now = new Date();
    const day = dayKey(now);
    const [users, counts, actor] = await Promise.all([
      this.users.findAll(),
      this.appeals.countsPerStaff(dayRange(now)),
      this.users.findById(actorId),
    ]);
    const wrote = new Set(counts.filter((c) => c.total > 0).map((c) => c.staffId));
    const targets = users.filter(
      (u) => REQUIRED_ROLES.includes(u.role) && u.id !== actorId && !isOnVacation(u, day) && (!onlyIdle || !wrote.has(u.id)),
    );
    const html = [
      '📣 <b>Eslatma</b>',
      '',
      onlyIdle ? 'Bugun hali ish yozmadingiz. Qilgan ishlaringizni yozib qo‘ying.' : 'Bugun qilgan ishlaringizni yozib borishni unutmang.',
      'Pastdagi tugmani bosing yoki ishni shu botga oddiy xabar qilib yuboring.',
      PENALTY_NOTE,
      actor ? `\n👤 ${escapeHtml(actor.fullName)}` : null,
    ]
      .filter((l) => l !== null)
      .join('\n');
    return this.delivery.sendBatch(
      'qolda_eslatma',
      `Qo‘lda eslatma (${onlyIdle ? 'ish yozmaganlarga' : 'hammaga'}) · ${shortDate(day)}`,
      targets,
      html,
      { buttons: WRITE_BUTTON, byName: actor?.fullName },
    );
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
