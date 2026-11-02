import { isValidObjectId } from 'mongoose';
import type { Penalty } from '../../domain/entities/Penalty.js';
import type { PenaltyRepository } from '../../domain/repositories/PenaltyRepository.js';
import { PenaltyModel, type PenaltyDoc } from '../db/models/PenaltyModel.js';

const toEntity = (doc: PenaltyDoc): Penalty => ({
  id: String(doc._id),
  userId: String(doc.userId),
  day: doc.day,
  points: doc.points,
  reason: doc.reason,
  notifiedAt: doc.notifiedAt ?? undefined,
  createdAt: doc.createdAt,
});

export class MongoPenaltyRepository implements PenaltyRepository {
  async create(data: { userId: string; day: string; points: number; reason: string }): Promise<Penalty | null> {
    try {
      return toEntity((await PenaltyModel.create(data)).toObject());
    } catch (err) {
      if ((err as { code?: number }).code === 11000) return null;
      throw err;
    }
  }

  async findById(id: string): Promise<Penalty | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await PenaltyModel.findById(id).lean();
    return doc ? toEntity(doc) : null;
  }

  async listByUser(userId: string): Promise<Penalty[]> {
    if (!isValidObjectId(userId)) return [];
    return (await PenaltyModel.find({ userId }).sort({ day: -1 }).lean()).map(toEntity);
  }

  async totals(): Promise<Record<string, number>> {
    const rows = await PenaltyModel.aggregate([{ $group: { _id: '$userId', total: { $sum: '$points' } } }]);
    return Object.fromEntries(rows.map((r) => [String(r._id), r.total]));
  }

  async listUnnotified(): Promise<Penalty[]> {
    return (await PenaltyModel.find({ notifiedAt: null }).sort({ day: 1 }).lean()).map(toEntity);
  }

  async markNotified(id: string): Promise<boolean> {
    const res = await PenaltyModel.updateOne({ _id: id, notifiedAt: null }, { $set: { notifiedAt: new Date() } });
    return res.modifiedCount === 1;
  }

  async delete(id: string): Promise<void> {
    await PenaltyModel.findByIdAndDelete(id);
  }
}
