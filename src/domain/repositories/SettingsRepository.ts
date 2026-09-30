import type { Settings } from '../entities/Settings.js';

export interface SettingsRepository {
  get(): Promise<Settings>;
  update(changes: Partial<Settings>): Promise<Settings>;
}
