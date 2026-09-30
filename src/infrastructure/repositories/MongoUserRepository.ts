import { isValidObjectId } from 'mongoose';
import type { Role, User } from '../../domain/entities/User.js';
import type { NewUser, UserRepository } from '../../domain/repositories/UserRepository.js';
import { UserModel, type UserDoc } from '../db/models/UserModel.js';

function toEntity(doc: UserDoc): User {
  return {
    id: String(doc._id),
    fullName: doc.fullName,
    username: doc.username,
    passwordHash: doc.passwordHash,
    role: doc.role,
    departmentId: doc.departmentId ? String(doc.departmentId) : undefined,
    telegramId: doc.telegramId ?? undefined,
    createdAt: doc.createdAt,
  };
}

export class MongoUserRepository implements UserRepository {
  async create(data: NewUser): Promise<User> {
    const doc = await UserModel.create(data);
    return toEntity(doc.toObject());
  }

  async findById(id: string): Promise<User | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await UserModel.findById(id).lean();
    return doc ? toEntity(doc) : null;
  }

  async findByIds(ids: string[]): Promise<User[]> {
    const docs = await UserModel.find({ _id: { $in: ids.filter((id) => isValidObjectId(id)) } }).lean();
    return docs.map(toEntity);
  }

  async findByUsername(username: string): Promise<User | null> {
    const doc = await UserModel.findOne({ username }).lean();
    return doc ? toEntity(doc) : null;
  }

  async findByTelegramId(telegramId: string): Promise<User | null> {
    const doc = await UserModel.findOne({ telegramId }).lean();
    return doc ? toEntity(doc) : null;
  }

  async findAll(filter: { departmentId?: string } = {}): Promise<User[]> {
    const query = filter.departmentId ? { departmentId: filter.departmentId } : {};
    const docs = await UserModel.find(query).sort({ fullName: 1 }).lean();
    return docs.map(toEntity);
  }

  async update(id: string, changes: Partial<NewUser>): Promise<User | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await UserModel.findByIdAndUpdate(id, changes, { new: true, runValidators: true }).lean();
    return doc ? toEntity(doc) : null;
  }

  async delete(id: string): Promise<void> {
    await UserModel.findByIdAndDelete(id);
  }

  async countByRole(role: Role): Promise<number> {
    return UserModel.countDocuments({ role });
  }

  async countByDepartment(departmentId: string): Promise<number> {
    return UserModel.countDocuments({ departmentId });
  }
}
