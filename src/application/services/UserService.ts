import { AppError } from '../../domain/errors/AppError.js';
import { toPublicUser, type PublicUser, type Role } from '../../domain/entities/User.js';
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
    return (await this.users.findAll()).map(toPublicUser);
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
    if (input.password) changes.passwordHash = await this.hasher.hash(input.password);
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

  async delete(actorId: string, id: string): Promise<void> {
    if (id === actorId) throw AppError.badRequest('O\'zingizni o\'chira olmaysiz');
    const user = await this.users.findById(id);
    if (!user) throw AppError.notFound('Xodim topilmadi');
    if ((await this.appeals.countByStaff(id)) > 0 || (await this.tasks.countByUser(id)) > 0) {
      throw AppError.conflict('Bu xodimda murojaat yoki topshiriqlar bor, tarix saqlanishi uchun o\'chirib bo\'lmaydi');
    }
    await this.users.delete(id);
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
