import type { Actor } from '../Actor.js';
import type { SettingsRepository } from '../../domain/repositories/SettingsRepository.js';
import { AppError } from '../../domain/errors/AppError.js';
import { can } from '../../domain/policies.js';
import type { AppealBreakdown, AppealRepository } from '../../domain/repositories/AppealRepository.js';
import type { UserRepository } from '../../domain/repositories/UserRepository.js';
import type { DepartmentRepository } from '../../domain/repositories/DepartmentRepository.js';
import { isActive, type Role, type UserStatus } from '../../domain/entities/User.js';
import { dayRange, eachDayKey, rangeOf, resolveRange, weekRange, type DateRange, type Period } from '../../shared/time.js';
import { resolveStaffScope, type ScopeQuery } from './scope.js';

export interface StatsQuery extends ScopeQuery {
  period?: Period;
  /** Aniq kun "YYYY-MM-DD" (kalendardan) */
  date?: string;
  month?: string;
}

export interface StatsResult extends Omit<AppealBreakdown, 'daily'> {
  range: DateRange;
  online: number;
  offline: number;
  daily: Array<{ date: string; count: number }>;
}

interface Counts {
  total: number;
  offline: number;
  online: number;
  resolved: number;
}

export interface StaffStatsRow extends Counts {
  staffId: string;
  fullName: string;
  username: string;
  role: Role;
  departmentId?: string;
  departmentName?: string;
  /** Pauzadagi/o'chirilgan xodim — faqat shu davrda ishi bo'lsa ko'rinadi */
  status: UserStatus;
}

export interface RatingRow {
  staffId: string;
  fullName: string;
  departmentName?: string;
  total: number;
  rank: number;
}

/** Reytingga kiradiganlar */
const RATED_ROLES: Role[] = ['xodim', 'bolim_boshligi'];

export interface DepartmentStatsRow extends Counts {
  departmentId: string | null;
  name: string;
  staffCount: number;
}

export class StatsService {
  constructor(
    private readonly appeals: AppealRepository,
    private readonly users: UserRepository,
    private readonly departments: DepartmentRepository,
    private readonly settings: SettingsRepository,
  ) {}

  /** Bugun / shu hafta / shu oy — faqat o'zining murojaatlari */
  async summary(actor: Actor) {
    const now = new Date();
    const staffIds = [actor.id];
    const [today, week, month] = await Promise.all([
      this.appeals.count({ ...dayRange(now), staffIds }),
      this.appeals.count({ ...weekRange(now), staffIds }),
      this.appeals.count({ ...resolveRange('month', undefined, now), staffIds }),
    ]);
    return { today, week, month };
  }

  /** Xodim — faqat o'ziniki. Rahbar — tanlangan xodim, bo'lim yoki hammasi. */
  async details(actor: Actor, query: StatsQuery): Promise<StatsResult> {
    const staffIds = await resolveStaffScope(actor, query, this.users);
    const range = rangeOf(query);
    const b = await this.appeals.breakdown({ ...range, staffIds });
    return {
      range,
      total: b.total,
      byChannel: b.byChannel,
      byVisitorType: b.byVisitorType,
      byStatus: b.byStatus,
      offline: b.byChannel.offline,
      online: b.byChannel.telefon + b.byChannel.telegram,
      daily: eachDayKey(range).map((date) => ({ date, count: b.daily[date] ?? 0 })),
    };
  }

  /**
   * Reyting: kim ko'p ish yozgan (faol xodimlar va bo'lim boshliqlari). Hamma ko'radi.
   * Teng ishli xodimlar bir xil o'rinda (1, 2, 2, 4 …).
   */
  async rating(actor: Actor, query: StatsQuery): Promise<{ range: DateRange; rows: RatingRow[] }> {
    if (!can.viewAll(actor.role) && !(await this.settings.get()).ratingVisible) {
      throw AppError.forbidden('Reyting hozircha yopiq');
    }
    const range = rangeOf(query);
    const [users, counts, departments] = await Promise.all([
      this.users.findAll(),
      this.appeals.countsPerStaff(range),
      this.departments.findAll(),
    ]);
    const totals = new Map(counts.map((c) => [c.staffId, c.total]));
    const deptNames = new Map(departments.map((d) => [d.id, d.name]));
    const sorted = users
      .filter((u) => RATED_ROLES.includes(u.role))
      .map((u) => ({
        staffId: u.id,
        fullName: u.fullName,
        departmentName: u.departmentId ? deptNames.get(u.departmentId) : undefined,
        total: totals.get(u.id) ?? 0,
      }))
      .sort((a, b) => b.total - a.total || a.fullName.localeCompare(b.fullName));
    const rows = sorted.map((r, i) => ({ ...r, rank: i > 0 && sorted[i - 1].total === r.total ? 0 : i + 1 }));
    // Teng bo'lsa — oldingi o'rin
    for (let i = 1; i < rows.length; i++) if (rows[i].rank === 0) rows[i].rank = rows[i - 1].rank;
    return { range, rows };
  }

  /** Rahbarlar: xodimlar va bo'limlar kesimida (murojaati yo'qlar ham ko'rinadi) */
  async perStaff(query: StatsQuery): Promise<{ range: DateRange; rows: StaffStatsRow[]; departments: DepartmentStatsRow[] }> {
    const range = rangeOf(query);
    const [users, counts, departments] = await Promise.all([
      this.users.findAll({ departmentId: query.departmentId, includeInactive: true }),
      this.appeals.countsPerStaff(range),
      this.departments.findAll(),
    ]);
    const byId = new Map(counts.map((c) => [c.staffId, c]));
    const deptNames = new Map(departments.map((d) => [d.id, d.name]));

    // Faol emaslar (pauza/o'chirilgan) faqat shu davrda ish yozgan bo'lsa — tarix to'g'ri bo'lishi uchun
    const rows: StaffStatsRow[] = users
      .filter((u) => isActive(u) || byId.has(u.id))
      .map((u) => {
        const c = byId.get(u.id);
        return {
          staffId: u.id,
          fullName: u.fullName,
          username: u.username,
          role: u.role,
          departmentId: u.departmentId,
          departmentName: u.departmentId ? deptNames.get(u.departmentId) : undefined,
          status: u.status,
          total: c?.total ?? 0,
          offline: c?.offline ?? 0,
          online: c?.online ?? 0,
          resolved: c?.resolved ?? 0,
        };
      })
      .sort((a, b) => b.total - a.total || a.fullName.localeCompare(b.fullName));

    const deptRows = new Map<string | null, DepartmentStatsRow>();
    for (const r of rows) {
      const key = r.departmentId ?? null;
      const d = deptRows.get(key) ?? { departmentId: key, name: r.departmentName ?? 'Bo\'limsiz', staffCount: 0, total: 0, offline: 0, online: 0, resolved: 0 };
      d.staffCount++;
      d.total += r.total;
      d.offline += r.offline;
      d.online += r.online;
      d.resolved += r.resolved;
      deptRows.set(key, d);
    }

    return { range, rows, departments: [...deptRows.values()].sort((a, b) => b.total - a.total) };
  }
}
