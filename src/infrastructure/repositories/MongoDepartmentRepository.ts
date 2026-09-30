import { isValidObjectId } from 'mongoose';
import type { Department } from '../../domain/entities/Department.js';
import type { DepartmentRepository } from '../../domain/repositories/DepartmentRepository.js';
import { DepartmentModel, type DepartmentDoc } from '../db/models/DepartmentModel.js';

const toEntity = (doc: DepartmentDoc): Department => ({ id: String(doc._id), name: doc.name, createdAt: doc.createdAt });

export class MongoDepartmentRepository implements DepartmentRepository {
  async create(name: string): Promise<Department> {
    return toEntity((await DepartmentModel.create({ name })).toObject());
  }

  async findById(id: string): Promise<Department | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await DepartmentModel.findById(id).lean();
    return doc ? toEntity(doc) : null;
  }

  async findByName(name: string): Promise<Department | null> {
    const doc = await DepartmentModel.findOne({ name }).collation({ locale: 'uz', strength: 2 }).lean();
    return doc ? toEntity(doc) : null;
  }

  async findAll(): Promise<Department[]> {
    return (await DepartmentModel.find().sort({ name: 1 }).lean()).map(toEntity);
  }

  async update(id: string, name: string): Promise<Department | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await DepartmentModel.findByIdAndUpdate(id, { name }, { new: true }).lean();
    return doc ? toEntity(doc) : null;
  }

  async delete(id: string): Promise<void> {
    await DepartmentModel.findByIdAndDelete(id);
  }
}
