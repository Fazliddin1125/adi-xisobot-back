import type { Actor } from '../Actor.js';
import { can } from '../../domain/policies.js';
import type { UserRepository } from '../../domain/repositories/UserRepository.js';

export interface ScopeQuery {
  staffId?: string;
  departmentId?: string;
}

/**
 * Murojaat/statistika qaysi xodimlar bo'yicha olinishini aniqlaydi.
 * Xodim — faqat o'zi. Rahbar — tanlangan xodim, tanlangan bo'lim yoki hammasi (undefined).
 */
export async function resolveStaffScope(actor: Actor, query: ScopeQuery, users: UserRepository): Promise<string[] | undefined> {
  if (!can.viewAll(actor.role)) return [actor.id];
  if (query.staffId) return [query.staffId];
  if (query.departmentId) return (await users.findAll({ departmentId: query.departmentId })).map((u) => u.id);
  return undefined;
}
