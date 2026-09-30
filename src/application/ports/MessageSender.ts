/** Foydalanuvchiga tashqi kanal (Telegram) orqali xabar yuborish */
export interface MessageSender {
  readonly enabled: boolean;
  /** html — Telegram HTML formatidagi matn */
  send(chatId: string, html: string): Promise<void>;
}
