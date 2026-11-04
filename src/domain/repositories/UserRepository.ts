import type { Role, User, UserStatus } from '../entities/User.js';

export interface NewUser {
  fullName: string;
  username: string;
  passwordHash: string;
  role: Role;
  departmentId?: string | null;
  telegramId?: string | null;
  vacationFrom?: string | null;
  vacationTo?: string | null;
  status?: UserStatus;
}

export interface UserRepository {
  create(data: NewUser): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByIds(ids: string[]): Promise<User[]>;
  findByUsername(username: string): Promise<User | null>;
  /** Faqat faol foydalanuvchi (bot pauzadagi/o'chirilganni tanimaydi) */
  findByTelegramId(telegramId: string): Promise<User | null>;
  /**
   * Standart: faqat faollar. includeInactive — pauzadagi va o'chirilganlar ham
   * (tarixdagi ismlar, chorak hisobotidagi eski ishlar uchun)
   */
  findAll(filter?: { departmentId?: string; includeInactive?: boolean }): Promise<User[]>;
  update(id: string, changes: Partial<NewUser>): Promise<User | null>;
  /** Parol almashganda: yangi hash + tokenVersion'ni oshirish (eski sessiyalar bekor) */
  setPassword(id: string, passwordHash: string): Promise<User | null>;
  delete(id: string): Promise<void>;
  countByRole(role: Role): Promise<number>;
  countByDepartment(departmentId: string): Promise<number>;
}
