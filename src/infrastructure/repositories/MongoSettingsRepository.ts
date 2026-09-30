import { DEFAULT_SETTINGS, type Settings } from '../../domain/entities/Settings.js';
import type { SettingsRepository } from '../../domain/repositories/SettingsRepository.js';
import { SettingsModel } from '../db/models/SettingsModel.js';

export class MongoSettingsRepository implements SettingsRepository {
  async get(): Promise<Settings> {
    const doc = await SettingsModel.findById('global').lean();
    if (!doc) return { ...DEFAULT_SETTINGS };
    return {
      appealStatusEnabled: doc.appealStatusEnabled ?? DEFAULT_SETTINGS.appealStatusEnabled,
      visitorTypeEnabled: doc.visitorTypeEnabled ?? DEFAULT_SETTINGS.visitorTypeEnabled,
      channelEnabled: doc.channelEnabled ?? DEFAULT_SETTINGS.channelEnabled,
    };
  }

  async update(changes: Partial<Settings>): Promise<Settings> {
    await SettingsModel.updateOne({ _id: 'global' }, { $set: changes }, { upsert: true });
    return this.get();
  }
}
