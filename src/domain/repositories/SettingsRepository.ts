import type { Settings } from '../entities/Settings.js';

export interface SettingsRepository {
  get(): Promise<Settings>;
  update(changes: Partial<Settings>): Promise<Settings>;
  /** Kunlik hisobotni shu kun uchun "egallash": true — hali yuborilmagan, endi yuboriladi */
  claimDailyReport(day: string): Promise<boolean>;
  /** Rejalashtirilgan ishni (key) shu kun uchun "egallash": true — hali bajarilmagan, endi bajariladi */
  claimJob(key: string, day: string): Promise<boolean>;
  /** Ish shu kun uchun bajarilganmi */
  jobDone(key: string, day: string): Promise<boolean>;
}
