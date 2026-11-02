import type { DeliveryLog } from '../entities/Delivery.js';

export interface DeliveryLogRepository {
  create(data: Omit<DeliveryLog, 'id' | 'createdAt'>): Promise<DeliveryLog>;
  listRecent(limit: number): Promise<DeliveryLog[]>;
}
