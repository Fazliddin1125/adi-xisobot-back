import type { Role, User } from '../entities/User.js';

export interface NewUser {
  fullName: string;
  username: string;
  passwordHash: string;
  role: Role;
  departmentId?: string | null;
  telegramId?: string | null;
}

export interface UserRepository {
  create(data: NewUser): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByIds(ids: string[]): Promise<User[]>;
  findByUsername(username: string): Promise<User | null>;
  findByTelegramId(telegramId: string): Promise<User | null>;
  findAll(filter?: { departmentId?: string }): Promise<User[]>;
  update(id: string, changes: Partial<NewUser>): Promise<User | null>;
  /** Parol almashganda: yangi hash + tokenVersion'ni oshirish (eski sessiyalar bekor) */
  setPassword(id: string, passwordHash: string): Promise<User | null>;
  delete(id: string): Promise<void>;
  countByRole(role: Role): Promise<number>;
  countByDepartment(departmentId: string): Promise<number>;
}
