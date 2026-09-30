import type { AppealRepository } from '../../domain/repositories/AppealRepository.js';
import type { UserRepository } from '../../domain/repositories/UserRepository.js';
import type { SettingsRepository } from '../../domain/repositories/SettingsRepository.js';
import type { ReportExporter } from '../ports/ReportExporter.js';
import type { Actor } from '../Actor.js';
import type { StatsQuery, StatsService } from './StatsService.js';
import { resolveStaffScope } from './scope.js';
import { dayKey, resolveRange } from '../../shared/time.js';

const PERIOD_TITLES = { today: 'Bugun', week: 'Shu hafta', month: 'Shu oy' } as const;

export class ExportService {
  constructor(
    private readonly appeals: AppealRepository,
    private readonly users: UserRepository,
    private readonly settings: SettingsRepository,
    private readonly stats: StatsService,
    private readonly exporter: ReportExporter,
  ) {}

  async appealsXlsx(actor: Actor, query: StatsQuery): Promise<{ filename: string; buffer: Buffer }> {
    const range = resolveRange(query.period, query.month);
    const staffIds = await resolveStaffScope(actor, query, this.users);
    const [appeals, users, perStaff, settings] = await Promise.all([
      this.appeals.list({ ...range, staffIds }),
      this.users.findAll(),
      this.stats.perStaff(query),
      this.settings.get(),
    ]);
    const names = new Map(users.map((u) => [u.id, u.fullName]));
    const deptOf = new Map(perStaff.rows.map((r) => [r.staffId, r.departmentName ?? '']));
    const title = query.month ?? PERIOD_TITLES[query.period ?? 'month'];
    const buffer = await this.exporter.toXlsx({
      range,
      title,
      fields: settings,
      appeals: appeals.map((a) => ({ ...a, staffName: names.get(a.staffId) ?? '—', departmentName: deptOf.get(a.staffId) ?? '' })),
      staffRows: query.staffId ? perStaff.rows.filter((r) => r.staffId === query.staffId) : perStaff.rows,
    });
    const suffix = query.month ?? `${dayKey(range.from)}_${dayKey(new Date(range.to.getTime() - 1))}`;
    return { filename: `ishlar_${suffix}.xlsx`, buffer };
  }
}
