/** Telegram WebApp initData'ni tekshiradi: haqiqiy bo'lsa — foydalanuvchining Telegram ID'si, aks holda null */
export interface TelegramAuthVerifier {
  verify(initData: string): string | null;
}
