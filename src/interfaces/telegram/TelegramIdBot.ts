import type { TelegramApi } from '../../infrastructure/telegram/TelegramApi.js';

interface Update {
  update_id: number;
  message?: { chat: { id: number; type: string }; from?: { first_name?: string }; text?: string };
}

/** Telegram chat ID bo'yicha ulangan foydalanuvchining F.I.Sh (ulanmagan bo'lsa null) */
export type LinkedUserLookup = (chatId: string) => Promise<string | null>;

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Botga yozgan har kimga salom beradi va bot nima uchun kerakligini tushuntiradi.
 * Ulanmagan odamga Telegram ID raqamini ham yuboradi — u shu raqamni superadminga beradi.
 * (Bot foydalanuvchiga xabar yubora olishi uchun ham avval /start bosilishi shart.)
 */
export class TelegramIdBot {
  private offset = 0;
  private running = false;

  constructor(
    private readonly api: TelegramApi,
    private readonly findLinkedUser: LinkedUserLookup,
    /** Jo'nalish kelishigida: "Fazliddinga (@fazliddin_bakhrom)" */
    private readonly supportContact: string,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.loop();
  }

  stop(): void {
    this.running = false;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        const updates = await this.api.call<Update[]>('getUpdates', { offset: this.offset, timeout: 30, allowed_updates: ['message'] }, 40_000);
        for (const u of updates) {
          this.offset = u.update_id + 1;
          if (u.message) await this.reply(u.message.chat.id, u.message.from?.first_name);
        }
      } catch (err) {
        console.error('Telegram getUpdates xatosi:', (err as Error).message);
        await new Promise((r) => setTimeout(r, 5_000));
      }
    }
  }

  /** Kontakt matnidan Telegram username (masalan "Fazliddinga (@fazliddin_bakhrom)" → "fazliddin_bakhrom") */
  private get supportUsername(): string | null {
    return /@([A-Za-z0-9_]{5,32})/.exec(this.supportContact)?.[1] ?? null;
  }

  private async reply(chatId: number, firstName?: string): Promise<void> {
    const linkedName = await this.findLinkedUser(String(chatId)).catch(() => null);
    const name = escapeHtml(linkedName ?? firstName ?? '');
    const username = this.supportUsername;
    const intro = "Bu — ADU ATM bo'limining yordamchi boti. Bu yerda sizga berilgan topshiriqlar va ularning muddatlari haqida xabar olasiz.";

    const text = linkedName
      ? [
          `Assalomu alaykum, <b>${name}</b>! 👋`,
          '',
          intro,
          '',
          '✅ Hisobingiz ulangan. Yangi topshiriq berilsa, darhol shu yerga yozaman.',
          `🆔 Telegram ID raqamingiz: <code>${chatId}</code>`,
          username ? `\n💬 Savollar bo'lsa: @${username}` : null,
        ]
      : [
          `Assalomu alaykum${name ? `, <b>${name}</b>` : ''}! 👋`,
          '',
          intro,
          '',
          `🆔 Sizning Telegram ID raqamingiz: <code>${chatId}</code>`,
          '<i>(raqam ustiga bossangiz, nusxa olinadi)</i>',
          '',
          username
            ? `👤 Xabarlar kela boshlashi uchun shu raqamni ${escapeHtml(this.supportContact.replace(/\s*\(@\w+\)/, ''))} yuboring: @${username}`
            : `👤 Xabarlar kela boshlashi uchun shu raqamni ${escapeHtml(this.supportContact)} yuboring.`,
        ];

    // Ulanmagan odamga — kontakt bilan chatni bir bosishda ochadigan tugma
    const replyMarkup =
      username && !linkedName
        ? { inline_keyboard: [[{ text: `✍️ @${username} ga yozish`, url: `https://t.me/${username}` }]] }
        : undefined;

    await this.api
      .call('sendMessage', {
        chat_id: chatId,
        text: text.filter((l) => l !== null).join('\n'),
        parse_mode: 'HTML',
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      })
      .catch((err) => {
        console.error('Telegram javob xatosi:', (err as Error).message);
      });
  }
}
