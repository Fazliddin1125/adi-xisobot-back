import type { Settings } from '../entities/Settings.js';

export interface SettingsRepository {
  get(): Promise<Settings>;
  update(changes: Partial<Settings>): Promise<Settings>;
  /** Kunlik hisobotni shu kun uchun "egallash": true — hali yuborilmagan, endi yuboriladi */
  claimDailyReport(day: string): Promise<boolean>;
}
