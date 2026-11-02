/** Jarima balli: ish yozilmagan kun uchun -1 */
export interface Penalty {
  id: string;
  userId: string;
  /** Qaysi kun uchun (Toshkent, "YYYY-MM-DD") */
  day: string;
  points: number;
  reason: string;
  /** Xodimga Telegram orqali xabar berilgan vaqt (ertasi kuni 08:30) */
  notifiedAt?: Date;
  createdAt: Date;
}
