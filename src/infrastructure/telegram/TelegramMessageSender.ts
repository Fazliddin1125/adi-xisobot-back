import type { MessageSender } from '../../application/ports/MessageSender.js';
import type { TelegramApi } from './TelegramApi.js';

export class TelegramMessageSender implements MessageSender {
  readonly enabled = true;
  constructor(private readonly api: TelegramApi) {}

  async send(chatId: string, html: string): Promise<void> {
    await this.api.call('sendMessage', { chat_id: chatId, text: html, parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
  }
}

/** Token berilmaganda: xabarlar yuborilmaydi */
export class DisabledMessageSender implements MessageSender {
  readonly enabled = false;
  async send(): Promise<void> {}
}
