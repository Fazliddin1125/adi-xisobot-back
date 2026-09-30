import { AppError } from '../../domain/errors/AppError.js';
import type { Appeal, AppealChanges, NewAppeal } from '../../domain/entities/Appeal.js';
import { can } from '../../domain/policies.js';
import type { AppealRepository } from '../../domain/repositories/AppealRepository.js';
import type { UserRepository } from '../../domain/repositories/UserRepository.js';
import type { SettingsRepository } from '../../domain/repositories/SettingsRepository.js';
import { isSameDay, resolveRange, type Period } from '../../shared/time.js';
import type { Actor } from '../Actor.js';
import { resolveStaffScope, type ScopeQuery } from './scope.js';

export type AppealView = Appeal & { staffName: string; editable: boolean };

export interface AppealListQuery extends ScopeQuery {
  period?: Period;
  month?: string;
}

export class AppealService {
  constructor(
    private readonly appeals: AppealRepository,
    private readonly users: UserRepository,
    private readonly settings: SettingsRepository,
  ) {}

  async create(actor: Actor, input: Omit<NewAppeal, 'staffId'>): Promise<AppealView> {
    const s = await this.settings.get();
    if (s.visitorTypeEnabled && !input.visitorType) throw AppError.badRequest('Toifani tanlang');
    if (s.channelEnabled && !input.channel) throw AppError.badRequest('Murojaat turini tanlang');
    // O'chirilgan maydonlar saqlanmaydi
    const appeal = await this.appeals.create({
      ...input,
      visitorType: s.visitorTypeEnabled ? input.visitorType : undefined,
      channel: s.channelEnabled ? input.channel : undefined,
      status: s.appealStatusEnabled ? (input.status ?? 'hal_qilindi') : undefined,
      staffId: actor.id,
    });
    return (await this.withViewFields(actor, [appeal]))[0];
  }

  /** Xodim faqat o'zinikini ko'radi; rahbarlar istalgan xodim/bo'lim yoki hammasini */
  async list(actor: Actor, query: AppealListQuery): Promise<AppealView[]> {
    const staffIds = await resolveStaffScope(actor, query, this.users);
    const range = resolveRange(query.period, query.month);
    const appeals = await this.appeals.list({ ...range, staffIds });
    return this.withViewFields(actor, appeals);
  }

  async update(actor: Actor, id: string, changes: AppealChanges): Promise<AppealView> {
    await this.getEditable(actor, id);
    const s = await this.settings.get();
    if (!s.appealStatusEnabled) delete changes.status;
    if (!s.visitorTypeEnabled) delete changes.visitorType;
    if (!s.channelEnabled) delete changes.channel;
    const updated = await this.appeals.update(id, changes);
    return (await this.withViewFields(actor, [updated!]))[0];
  }

  async delete(actor: Actor, id: string): Promise<void> {
    await this.getEditable(actor, id);
    await this.appeals.delete(id);
  }

  /** Xodim o'zi bugun kiritganini, superadmin istalganini o'zgartira oladi */
  canEdit(actor: Actor, appeal: Appeal, now = new Date()): boolean {
    if (can.editAnyAppeal(actor.role)) return true;
    return appeal.staffId === actor.id && isSameDay(appeal.createdAt, now);
  }

  private async getEditable(actor: Actor, id: string): Promise<Appeal> {
    const appeal = await this.appeals.findById(id);
    if (!appeal || (!can.viewAll(actor.role) && appeal.staffId !== actor.id)) {
      throw AppError.notFound('Ish topilmadi');
    }
    if (!this.canEdit(actor, appeal)) {
      throw AppError.forbidden(
        appeal.staffId === actor.id ? 'Ishni faqat kiritilgan kuni o\'zgartirish mumkin' : 'Boshqa xodimning ishini o\'zgartira olmaysiz',
      );
    }
    return appeal;
  }

  private async withViewFields(actor: Actor, appeals: Appeal[]): Promise<AppealView[]> {
    const names = new Map((await this.users.findAll()).map((u) => [u.id, u.fullName]));
    const now = new Date();
    return appeals.map((a) => ({
      ...a,
      staffName: names.get(a.staffId) ?? '—',
      editable: this.canEdit(actor, a, now),
    }));
  }
}
