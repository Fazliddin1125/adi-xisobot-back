import type { TelegramApi } from '../../infrastructure/telegram/TelegramApi.js';

interface Update {
  update_id: number;
  message?: { chat: { id: number; type: string }; from?: { first_name?: string }; text?: string };
}

/**
 * Botga yozgan har kimga uning Telegram ID raqamini qaytaradi.
 * Xodim botga /start bosadi → ID ni superadminga beradi → superadmin profilga kiritadi.
 * (Bot foydalanuvchiga xabar yubora olishi uchun ham avval /start bosilishi shart.)
 */
export class TelegramIdBot {
  private offset = 0;
  private running = false;

  constructor(private readonly api: TelegramApi) {}

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

  private async reply(chatId: number, name?: string): Promise<void> {
    const text = [
      `Assalomu alaykum${name ? `, ${name.replace(/[<>&]/g, '')}` : ''}!`,
      '',
      `Sizning Telegram ID raqamingiz: <code>${chatId}</code>`,
      '',
      'Shu raqamni ATM tizimi administratoriga yuboring. U kiritilgach, sizga berilgan topshiriqlar haqida shu yerga xabar keladi.',
    ].join('\n');
    await this.api.call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' }).catch((err) => {
      console.error('Telegram javob xatosi:', (err as Error).message);
    });
  }
}
