import { Types, isValidObjectId } from 'mongoose';
import {
  CHANNELS,
  ONLINE_CHANNELS,
  STATUSES,
  VISITOR_TYPES,
  type Appeal,
  type AppealChanges,
  type NewAppeal,
} from '../../domain/entities/Appeal.js';
import type {
  AppealBreakdown,
  AppealFilter,
  AppealRepository,
  StaffCounts,
} from '../../domain/repositories/AppealRepository.js';
import { TIMEZONE } from '../../shared/time.js';
import { AppealModel, type AppealDoc } from '../db/models/AppealModel.js';

function toEntity(doc: AppealDoc): Appeal {
  return {
    id: String(doc._id),
    title: doc.title,
    visitorType: doc.visitorType ?? undefined,
    channel: doc.channel ?? undefined,
    status: doc.status ?? undefined,
    comment: doc.comment ?? undefined,
    staffId: String(doc.staffId),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toMatch({ from, to, staffIds }: AppealFilter) {
  return {
    createdAt: { $gte: from, $lt: to },
    ...(staffIds ? { staffId: { $in: staffIds.map((id) => new Types.ObjectId(id)) } } : {}),
  };
}

function zeroes<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
}

function fill<K extends string>(keys: readonly K[], rows: Array<{ _id: K; n: number }>): Record<K, number> {
  const out = zeroes(keys);
  for (const r of rows) if (r._id in out) out[r._id] = r.n;
  return out;
}

export class MongoAppealRepository implements AppealRepository {
  async create(data: NewAppeal): Promise<Appeal> {
    const doc = await AppealModel.create(data);
    return toEntity(doc.toObject());
  }

  async findById(id: string): Promise<Appeal | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await AppealModel.findById(id).lean();
    return doc ? toEntity(doc) : null;
  }

  async update(id: string, changes: AppealChanges): Promise<Appeal | null> {
    const { comment, ...rest } = changes;
    const update =
      comment === undefined ? rest : comment === '' ? { ...rest, $unset: { comment: 1 } } : { ...rest, comment };
    const doc = await AppealModel.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();
    return doc ? toEntity(doc) : null;
  }

  async delete(id: string): Promise<void> {
    await AppealModel.findByIdAndDelete(id);
  }

  async list(filter: AppealFilter): Promise<Appeal[]> {
    const docs = await AppealModel.find(toMatch(filter)).sort({ createdAt: -1 }).lean();
    return docs.map(toEntity);
  }

  async count(filter: AppealFilter): Promise<number> {
    return AppealModel.countDocuments(toMatch(filter));
  }

  async countByStaff(staffId: string): Promise<number> {
    return AppealModel.countDocuments({ staffId: new Types.ObjectId(staffId) });
  }

  async breakdown(filter: AppealFilter): Promise<AppealBreakdown> {
    const group = (field: string) => [{ $group: { _id: `$${field}`, n: { $sum: 1 } } }];
    const [res] = await AppealModel.aggregate([
      { $match: toMatch(filter) },
      {
        $facet: {
          total: [{ $count: 'n' }],
          byChannel: group('channel'),
          byVisitorType: group('visitorType'),
          byStatus: group('status'),
          daily: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TIMEZONE } },
                n: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);
    return {
      total: res.total[0]?.n ?? 0,
      byChannel: fill(CHANNELS, res.byChannel),
      byVisitorType: fill(VISITOR_TYPES, res.byVisitorType),
      byStatus: fill(STATUSES, res.byStatus),
      daily: Object.fromEntries(res.daily.map((d: { _id: string; n: number }) => [d._id, d.n])),
    };
  }

  async countsPerStaff(filter: AppealFilter): Promise<StaffCounts[]> {
    const rows = await AppealModel.aggregate([
      { $match: toMatch(filter) },
      {
        $group: {
          _id: '$staffId',
          total: { $sum: 1 },
          offline: { $sum: { $cond: [{ $eq: ['$channel', 'offline'] }, 1, 0] } },
          online: { $sum: { $cond: [{ $in: ['$channel', ONLINE_CHANNELS] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'hal_qilindi'] }, 1, 0] } },
        },
      },
    ]);
    return rows.map((r) => ({ staffId: String(r._id), total: r.total, offline: r.offline, online: r.online, resolved: r.resolved }));
  }
}
