import type { Settings } from '../../domain/entities/Settings.js';
import type { SettingsRepository } from '../../domain/repositories/SettingsRepository.js';

export class SettingsService {
  constructor(private readonly settings: SettingsRepository) {}

  get(): Promise<Settings> {
    return this.settings.get();
  }

  update(changes: Partial<Settings>): Promise<Settings> {
    return this.settings.update(changes);
  }
}
