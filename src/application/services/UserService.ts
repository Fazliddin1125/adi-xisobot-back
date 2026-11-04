import { AppError } from '../../domain/errors/AppError.js';
import { toPublicUser, type PublicUser, type Role, type UserStatus } from '../../domain/entities/User.js';
import type { NewUser, UserRepository } from '../../domain/repositories/UserRepository.js';
import type { AppealRepository } from '../../domain/repositories/AppealRepository.js';
import type { DepartmentRepository } from '../../domain/repositories/DepartmentRepository.js';
import type { TaskRepository } from '../../domain/repositories/TaskRepository.js';
import type { PasswordHasher } from '../ports/PasswordHasher.js';

export interface CreateUserInput {
  fullName: string;
  username: string;
  password: string;
  role: Role;
  departmentId?: string | null;
  telegramId?: string | null;
}

export type UpdateUserInput = Partial<CreateUserInput>;

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly appeals: AppealRepository,
    private readonly tasks: TaskRepository,
    private readonly departments: DepartmentRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async list(): Promise<PublicUser[]> {
    // Pauzadagilar ham (qayta faollashtirish uchun); o'chirilganlar — yo'q
    return (await this.users.findAll({ includeInactive: true })).filter((u) => u.status !== 'deleted').map(toPublicUser);
  }

  async get(id: string): Promise<PublicUser> {
    const user = await this.users.findById(id);
    if (!user) throw AppError.notFound('Xodim topilmadi');
    return toPublicUser(user);
  }

  async create(input: CreateUserInput): Promise<PublicUser> {
    const username = input.username.trim().toLowerCase();
    if (await this.users.findByUsername(username)) throw AppError.conflict('Bu login band');
    await this.assertDepartment(input.departmentId);
    const user = await this.users.create({
      fullName: input.fullName.trim(),
      username,
      role: input.role,
      departmentId: input.departmentId || null,
      telegramId: input.telegramId || null,
      passwordHash: await this.hasher.hash(input.password),
    });
    return toPublicUser(user);
  }

  async update(actorId: string, id: string, input: UpdateUserInput): Promise<PublicUser> {
    const user = await this.users.findById(id);
    if (!user) throw AppError.notFound('Xodim topilmadi');

    const changes: Partial<NewUser> = {};
    if (input.fullName) changes.fullName = input.fullName.trim();
    if (input.username) {
      const username = input.username.trim().toLowerCase();
      const existing = await this.users.findByUsername(username);
      if (existing && existing.id !== id) throw AppError.conflict('Bu login band');
      changes.username = username;
    }
    // Parol alohida saqlanadi: tokenVersion oshadi va xodimning barcha sessiyalari yopiladi
    if (input.password) await this.users.setPassword(id, await this.hasher.hash(input.password));
    if (input.departmentId !== undefined) {
      await this.assertDepartment(input.departmentId);
      changes.departmentId = input.departmentId || null;
    }
    if (input.telegramId !== undefined) changes.telegramId = input.telegramId || null;
    if (input.role && input.role !== user.role) {
      if (id === actorId) throw AppError.badRequest('O\'z rolingizni o\'zgartira olmaysiz');
      if (user.role === 'superadmin' && (await this.users.countByRole('superadmin')) <= 1) {
        throw AppError.badRequest('Tizimda kamida bitta superadmin qolishi kerak');
      }
      changes.role = input.role;
    }

    const updated = await this.users.update(id, changes);
    return toPublicUser(updated!);
  }

  /** Rahbarlar: xodimni ta'tilga chiqarish (null — ta'tilni tugatish) */
  async setVacation(id: string, vacation: { from: string; to: string } | null): Promise<PublicUser> {
    if (vacation && vacation.from > vacation.to) throw AppError.badRequest('Ta\'til tugash sanasi boshlanishidan oldin bo\'lmasin');
    const updated = await this.users.update(id, { vacationFrom: vacation?.from ?? null, vacationTo: vacation?.to ?? null });
    if (!updated) throw AppError.notFound('Xodim topilmadi');
    return toPublicUser(updated);
  }

  /**
   * Ishi/topshirig'i yo'q bo'lsa — butunlay o'chiriladi. Bor bo'lsa — "o'chirilgan" holatiga o'tadi:
   * kira olmaydi, hech qayerda ko'rinmaydi, lekin yozgan ishlari tarixda ismi bilan qoladi.
   * Login va Telegram ID bo'shatiladi (yangi xodimga berish mumkin).
   */
  async delete(actorId: string, id: string): Promise<{ kept: boolean }> {
    if (id === actorId) throw AppError.badRequest('O\'zingizni o\'chira olmaysiz');
    const user = await this.users.findById(id);
    if (!user || user.status === 'deleted') throw AppError.notFound('Xodim topilmadi');
    await this.assertNotLastSuperadmin(user);
    if ((await this.appeals.countByStaff(id)) === 0 && (await this.tasks.countByUser(id)) === 0) {
      await this.users.delete(id);
      return { kept: false };
    }
    await this.users.update(id, {
      status: 'deleted',
      username: `${user.username}~${id.slice(-6)}`,
      telegramId: null,
      vacationFrom: null,
      vacationTo: null,
    });
    // Ochiq sessiyalarni ham yopamiz
    await this.users.setPassword(id, user.passwordHash);
    return { kept: true };
  }

  /** Superadmin: pauza (vaqtincha to'xtatish) yoki qayta faollashtirish */
  async setStatus(actorId: string, id: string, status: Exclude<UserStatus, 'deleted'>): Promise<PublicUser> {
    if (id === actorId) throw AppError.badRequest('O\'zingizni to\'xtata olmaysiz');
    const user = await this.users.findById(id);
    if (!user || user.status === 'deleted') throw AppError.notFound('Xodim topilmadi');
    if (status === 'paused') await this.assertNotLastSuperadmin(user);
    const updated = await this.users.update(id, { status });
    // Pauzaga olinganda ochiq sessiyalar yopiladi
    if (status === 'paused') await this.users.setPassword(id, user.passwordHash);
    return toPublicUser(updated!);
  }

  private async assertNotLastSuperadmin(user: { role: Role }) {
    if (user.role === 'superadmin' && (await this.users.findAll()).filter((u) => u.role === 'superadmin').length <= 1) {
      throw AppError.badRequest('Tizimda kamida bitta faol superadmin qolishi kerak');
    }
  }

  /** Bazada superadmin bo'lmasa, .env dagi ma'lumotlar bilan yaratadi */
  async ensureSuperadmin(fullName: string, username: string, password: string): Promise<boolean> {
    if ((await this.users.countByRole('superadmin')) > 0) return false;
    await this.create({ fullName, username, password, role: 'superadmin' });
    return true;
  }

  private async assertDepartment(departmentId?: string | null) {
    if (departmentId && !(await this.departments.findById(departmentId))) {
      throw AppError.badRequest('Bo\'lim topilmadi');
    }
  }
}
