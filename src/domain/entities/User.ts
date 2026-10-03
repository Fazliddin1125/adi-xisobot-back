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
  createdAt: Date;
}

export type PublicUser = Omit<User, 'passwordHash' | 'tokenVersion'>;

export function toPublicUser({ passwordHash: _hash, tokenVersion: _version, ...rest }: User): PublicUser {
  return rest;
}
