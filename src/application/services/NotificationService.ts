import type { Task } from '../../domain/entities/Task.js';
import type { UserRepository } from '../../domain/repositories/UserRepository.js';
import { AppError } from '../../domain/errors/AppError.js';
import { dayKey } from '../../shared/time.js';
import type { MessageSender } from '../ports/MessageSender.js';

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

export class NotificationService {
  constructor(
    private readonly sender: MessageSender,
    private readonly users: UserRepository,
    private readonly appUrl?: string,
  ) {}

  /**
   * Yangi ijrochilarga "sizga topshiriq berildi" xabari.
   * Xatolik topshiriq saqlanishiga ta'sir qilmaydi — faqat logga yoziladi.
   */
  async taskAssigned(task: Task, recipientIds: string[]): Promise<void> {
    if (!this.sender.enabled) return;
    const ids = recipientIds.filter((id) => id !== task.creatorId);
    if (!ids.length) return;

    const [recipients, creator] = await Promise.all([this.users.findByIds(ids), this.users.findById(task.creatorId)]);
    const lines = [
      '📌 <b>Sizga yangi topshiriq berildi</b>',
      '',
      `<b>${escapeHtml(task.title)}</b>`,
      task.description ? escapeHtml(truncate(task.description, 600)) : null,
      '',
      `🗓 Muddat: <b>${dayKey(task.deadline).split('-').reverse().join('.')}</b>`,
      `👤 Muallif: ${escapeHtml(creator?.fullName ?? '—')}`,
      this.appUrl ? `\n<a href="${this.appUrl}/topshiriqlar">Saytda ochish</a>` : null,
    ].filter((l) => l !== null);
    const html = lines.join('\n');

    await Promise.all(
      recipients
        .filter((u) => u.telegramId)
        .map((u) =>
          this.sender.send(u.telegramId!, html).catch((err) => {
            console.error(`Telegram xabari yuborilmadi (${u.username}):`, (err as Error).message);
          }),
        ),
    );
  }

  /** Bajarilgan topshiriq izoh bilan qaytarilganda — ijrochilarga (qaytargandan tashqari) */
  async taskReturned(task: Task, actorId: string, comment: string): Promise<void> {
    if (!this.sender.enabled) return;
    const ids = task.assigneeIds.filter((id) => id !== actorId);
    if (!ids.length) return;

    const [recipients, actor] = await Promise.all([this.users.findByIds(ids), this.users.findById(actorId)]);
    const html = [
      '↩️ <b>Topshiriq qayta ishlashga qaytarildi</b>',
      '',
      `<b>${escapeHtml(task.title)}</b>`,
      '',
      `💬 Izoh: <i>${escapeHtml(truncate(comment, 800))}</i>`,
      `👤 Qaytargan: ${escapeHtml(actor?.fullName ?? '—')}`,
      `🗓 Muddat: <b>${dayKey(task.deadline).split('-').reverse().join('.')}</b>`,
      this.appUrl ? `\n<a href="${this.appUrl}/topshiriqlar">Saytda ochish</a>` : null,
    ]
      .filter((l) => l !== null)
      .join('\n');

    await Promise.all(
      recipients
        .filter((u) => u.telegramId)
        .map((u) =>
          this.sender.send(u.telegramId!, html).catch((err) => {
            console.error(`Telegram xabari yuborilmadi (${u.username}):`, (err as Error).message);
          }),
        ),
    );
  }

  /** Umumiy ishni kimdir qabul qilganda — ishni yaratgan rahbarga */
  async taskClaimed(task: Task, claimerId: string): Promise<void> {
    if (!this.sender.enabled || task.creatorId === claimerId) return;
    const [creator, claimer] = await Promise.all([this.users.findById(task.creatorId), this.users.findById(claimerId)]);
    if (!creator?.telegramId) return;
    const html = [
      '🙋 <b>Umumiy ish qabul qilindi</b>',
      '',
      `<b>${escapeHtml(task.title)}</b>`,
      `👤 Qabul qildi: ${escapeHtml(claimer?.fullName ?? '—')}`,
      `🗓 Muddat: <b>${dayKey(task.deadline).split('-').reverse().join('.')}</b>`,
    ].join('\n');
    await this.sender.send(creator.telegramId, html).catch((err) => {
      console.error(`Telegram xabari yuborilmadi (${creator.username}):`, (err as Error).message);
    });
  }

  /** Superadmin: ID to'g'riligini tekshirish uchun sinov xabari */
  async sendTest(userId: string): Promise<void> {
    if (!this.sender.enabled) throw AppError.badRequest('Telegram bot sozlanmagan (TELEGRAM_BOT_TOKEN yo\'q)');
    const user = await this.users.findById(userId);
    if (!user) throw AppError.notFound('Foydalanuvchi topilmadi');
    if (!user.telegramId) throw AppError.badRequest('Bu foydalanuvchiga Telegram ID kiritilmagan');
    try {
      await this.sender.send(user.telegramId, `✅ Salom, ${escapeHtml(user.fullName)}! ATM tizimi bildirishnomalari shu yerga keladi.`);
    } catch (err) {
      throw AppError.badRequest(`Xabar yuborilmadi: ${(err as Error).message}. Foydalanuvchi botga /start bosganmi va ID to'g'rimi?`);
    }
  }
}
