/** Xabar ostidagi tugma: bot ushlaydigan callback yoki bot ichida ochiladigan sayt (WebApp) */
export type InlineButton = { text: string; callback_data: string } | { text: string; web_app: { url: string } };

/**
 * "✍️ Ish yozish" tugmasi: sayt HTTPS bo'lsa — bot ichida sayt (WebApp) ochiladi,
 * aks holda (Telegram faqat HTTPS'ni qabul qiladi) — bot ishni xabar qilib so'raydi.
 */
export function writeButton(appUrl?: string): InlineButton[][] {
  return appUrl?.startsWith('https://')
    ? [[{ text: '✍️ Ish yozish', web_app: { url: `${appUrl}/tg/ish` } }]]
    : [[{ text: '✍️ Ish yozish', callback_data: 'write' }]];
}

/** Foydalanuvchiga tashqi kanal (Telegram) orqali xabar yuborish */
export interface MessageSender {
  readonly enabled: boolean;
  /** html — Telegram HTML formatidagi matn; buttons — xabar ostidagi tugmalar (callback yoki WebApp) */
  send(chatId: string, html: string, buttons?: InlineButton[][]): Promise<void>;
}
