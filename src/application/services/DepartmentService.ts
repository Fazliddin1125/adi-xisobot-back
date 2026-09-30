import { AppError } from '../../domain/errors/AppError.js';
import type { Department } from '../../domain/entities/Department.js';
import type { DepartmentRepository } from '../../domain/repositories/DepartmentRepository.js';
import type { UserRepository } from '../../domain/repositories/UserRepository.js';

export class DepartmentService {
  constructor(
    private readonly departments: DepartmentRepository,
    private readonly users: UserRepository,
  ) {}

  list(): Promise<Department[]> {
    return this.departments.findAll();
  }

  async create(name: string): Promise<Department> {
    if (await this.departments.findByName(name.trim())) throw AppError.conflict('Bunday bo\'lim bor');
    return this.departments.create(name.trim());
  }

  async update(id: string, name: string): Promise<Department> {
    const existing = await this.departments.findByName(name.trim());
    if (existing && existing.id !== id) throw AppError.conflict('Bunday bo\'lim bor');
    const updated = await this.departments.update(id, name.trim());
    if (!updated) throw AppError.notFound('Bo\'lim topilmadi');
    return updated;
  }

  async delete(id: string): Promise<void> {
    if ((await this.users.countByDepartment(id)) > 0) {
      throw AppError.conflict('Bo\'limda xodimlar bor. Avval ularni boshqa bo\'limga o\'tkazing');
    }
    await this.departments.delete(id);
  }
}
