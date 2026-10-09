export const ROLES = ['superadmin', 'markaz_boshligi', 'bolim_boshligi', 'xodim'] as const;
export type Role = (typeof ROLES)[number];

export interface User {
  id: string;
  fullName: string;
  username: string;
  passwordHash: string;
  /** Sessiyalar versiyasi: parol o'zgarganda oshadi va barcha eski tokenlar yaroqsiz bo'ladi */
  tokenVersion: number;
  role: Role;
  departmentId?: string;
  /** Telegram chat ID — topshiriq bildirishnomalari uchun */
  telegramId?: string;
  /** Ta'til: "YYYY-MM-DD" (Toshkent), ikkala kun ham kiradi. Ta'tildagiga topshiriq berish mumkin */
  vacationFrom?: string;
  vacationTo?: string;
  createdAt: Date;
}

export type PublicUser = Omit<User, 'passwordHash' | 'tokenVersion'>;

/** Berilgan kunda (Toshkent, "YYYY-MM-DD") ta'tildami */
export function isOnVacation(user: Pick<User, 'vacationFrom' | 'vacationTo'>, day: string): boolean {
  return !!user.vacationFrom && !!user.vacationTo && user.vacationFrom <= day && day <= user.vacationTo;
}

export function toPublicUser({ passwordHash: _hash, tokenVersion: _version, ...rest }: User): PublicUser {
  return rest;
}
