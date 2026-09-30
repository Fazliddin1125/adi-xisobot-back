import type { Department } from '../entities/Department.js';

export interface DepartmentRepository {
  create(name: string): Promise<Department>;
  findById(id: string): Promise<Department | null>;
  findByName(name: string): Promise<Department | null>;
  findAll(): Promise<Department[]>;
  update(id: string, name: string): Promise<Department | null>;
  delete(id: string): Promise<void>;
}
