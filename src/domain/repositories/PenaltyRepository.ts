import type { Penalty } from '../entities/Penalty.js';

export interface PenaltyRepository {
  /** Shu kun uchun allaqachon bo'lsa — qayta yaratilmaydi (null) */
  create(data: { userId: string; day: string; points: number; reason: string }): Promise<Penalty | null>;
  findById(id: string): Promise<Penalty | null>;
  listByUser(userId: string): Promise<Penalty[]>;
  /** userId → ballar yig'indisi (manfiy) */
  totals(): Promise<Record<string, number>>;
  /** Hali xabar berilmaganlar */
  listUnnotified(): Promise<Penalty[]>;
  /** Atomik: true — shu chaqiruv belgiladi (ikki marta xabar yubormaslik uchun) */
  markNotified(id: string): Promise<boolean>;
  delete(id: string): Promise<void>;
}
