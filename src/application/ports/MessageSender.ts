/** Foydalanuvchiga tashqi kanal (Telegram) orqali xabar yuborish */
export interface MessageSender {
  readonly enabled: boolean;
  /** html — Telegram HTML formatidagi matn; buttons — xabar ostidagi tugmalar (bot qayta ishlaydigan callback) */
  send(chatId: string, html: string, buttons?: Array<Array<{ text: string; callback_data: string }>>): Promise<void>;
}
