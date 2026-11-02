import type { DeliveryLog } from '../../domain/entities/Delivery.js';
import type { DeliveryLogRepository } from '../../domain/repositories/DeliveryLogRepository.js';
import { DeliveryLogModel, type DeliveryLogDoc } from '../db/models/DeliveryLogModel.js';

const toEntity = (doc: DeliveryLogDoc): DeliveryLog => ({
  id: String(doc._id),
  kind: doc.kind,
  title: doc.title,
  byName: doc.byName ?? undefined,
  results: (doc.results ?? []).map((r) => ({ userId: String(r.userId), fullName: r.fullName, ok: r.ok, reason: r.reason ?? undefined })),
  createdAt: doc.createdAt,
});

export class MongoDeliveryLogRepository implements DeliveryLogRepository {
  async create(data: Omit<DeliveryLog, 'id' | 'createdAt'>): Promise<DeliveryLog> {
    return toEntity((await DeliveryLogModel.create(data)).toObject());
  }

  async listRecent(limit: number): Promise<DeliveryLog[]> {
    return (await DeliveryLogModel.find().sort({ createdAt: -1 }).limit(limit).lean()).map(toEntity);
  }
}
