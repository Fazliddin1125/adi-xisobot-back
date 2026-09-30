export const ROLES = ['superadmin', 'markaz_boshligi', 'bolim_boshligi', 'xodim'] as const;
export type Role = (typeof ROLES)[number];

export interface User {
  id: string;
  fullName: string;
  username: string;
  passwordHash: string;
  role: Role;
  departmentId?: string;
  /** Telegram chat ID — topshiriq bildirishnomalari uchun */
  telegramId?: string;
  createdAt: Date;
}

export type PublicUser = Omit<User, 'passwordHash'>;

export function toPublicUser({ passwordHash: _omit, ...rest }: User): PublicUser {
  return rest;
}
