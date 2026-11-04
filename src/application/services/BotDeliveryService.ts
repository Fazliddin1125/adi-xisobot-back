import type { DeliveryKind, DeliveryLog, DeliveryResult } from '../../domain/entities/Delivery.js';
import type { User } from '../../domain/entities/User.js';
import type { DeliveryLogRepository } from '../../domain/repositories/DeliveryLogRepository.js';
import type { InlineButton, MessageSender } from '../ports/MessageSender.js';

type Buttons = InlineButton[][];

/** Telegram xatosini odamcha sababga aylantiradi */
export function deliveryReason(err: unknown): string {
  const msg = (err as Error).message ?? String(err);
  if (/chat not found|can't initiate|user not found/i.test(msg)) return 'Botga /start bosmagan (yoki Telegram ID noto‘g‘ri)';
  if (/blocked/i.test(msg)) return 'Botni bloklagan';
  if (/deactivated/i.test(msg)) return 'Telegram hisobi o‘chirilgan';
  if (/fetch failed|timeout|ETIMEDOUT|EAI_AGAIN/i.test(msg)) return 'Server Telegram’ga ulana olmadi';
  return msg;
}

/**
 * Bir nechta odamga bot xabarini yuboradi va kim olgani/olmaganini jurnalga yozadi
 * (admin "Bot xabarlari" sahifasida ko'radi).
 */
export class BotDeliveryService {
  constructor(
    private readonly sender: MessageSender,
    private readonly logs: DeliveryLogRepository,
  ) {}

  get enabled(): boolean {
    return this.sender.enabled;
  }

  async sendBatch(
    kind: DeliveryKind,
    title: string,
    recipients: User[],
    message: string | string[] | ((u: User) => string),
    options: { buttons?: Buttons; byName?: string } = {},
  ): Promise<DeliveryLog | null> {
    if (!recipients.length) return null;
    const results: DeliveryResult[] = [];
    for (const u of recipients) {
      const base = { userId: u.id, fullName: u.fullName };
      if (!u.telegramId) {
        results.push({ ...base, ok: false, reason: 'Telegram ID kiritilmagan' });
        continue;
      }
      const parts = typeof message === 'function' ? [message(u)] : Array.isArray(message) ? message : [message];
      try {
        for (const [i, html] of parts.entries()) await this.sender.send(u.telegramId, html, i === parts.length - 1 ? options.buttons : undefined);
        results.push({ ...base, ok: true });
      } catch (err) {
        results.push({ ...base, ok: false, reason: deliveryReason(err) });
      }
    }
    const log = await this.logs.create({ kind, title, byName: options.byName, results });
    console.log(`${title}: ${results.filter((r) => r.ok).length}/${results.length} yetib bordi`);
    return log;
  }

  listRecent(limit = 50): Promise<DeliveryLog[]> {
    return this.logs.listRecent(limit);
  }
}
