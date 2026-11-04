import { isValidObjectId } from 'mongoose';
import type { Role, User } from '../../domain/entities/User.js';
import type { NewUser, UserRepository } from '../../domain/repositories/UserRepository.js';
import { UserModel, type UserDoc } from '../db/models/UserModel.js';

/** Eski yozuvlarda status yo'q — ular faol */
const ACTIVE = { status: { $nin: ['paused', 'deleted'] as string[] } } as Record<string, unknown>;

function toEntity(doc: UserDoc): User {
  return {
    id: String(doc._id),
    fullName: doc.fullName,
    username: doc.username,
    passwordHash: doc.passwordHash,
    tokenVersion: doc.tokenVersion ?? 0,
    role: doc.role,
    status: doc.status ?? 'active',
    departmentId: doc.departmentId ? String(doc.departmentId) : undefined,
    telegramId: doc.telegramId ?? undefined,
    vacationFrom: doc.vacationFrom ?? undefined,
    vacationTo: doc.vacationTo ?? undefined,
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
    const doc = await UserModel.findOne({ telegramId, ...ACTIVE }).lean();
    return doc ? toEntity(doc) : null;
  }

  async findAll(filter: { departmentId?: string; includeInactive?: boolean } = {}): Promise<User[]> {
    const query: Record<string, unknown> = {
      ...(filter.departmentId ? { departmentId: filter.departmentId } : {}),
      ...(filter.includeInactive ? {} : ACTIVE),
    };
    const docs = await UserModel.find(query).sort({ fullName: 1 }).lean();
    return docs.map(toEntity);
  }

  async update(id: string, changes: Partial<NewUser>): Promise<User | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await UserModel.findByIdAndUpdate(id, changes, { new: true, runValidators: true }).lean();
    return doc ? toEntity(doc) : null;
  }

  async setPassword(id: string, passwordHash: string): Promise<User | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await UserModel.findByIdAndUpdate(id, { passwordHash, $inc: { tokenVersion: 1 } }, { new: true }).lean();
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
