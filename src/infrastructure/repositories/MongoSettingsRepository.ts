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
      reportGenerationEnabled: doc.reportGenerationEnabled ?? DEFAULT_SETTINGS.reportGenerationEnabled,
      dailyReportEnabled: doc.dailyReportEnabled ?? DEFAULT_SETTINGS.dailyReportEnabled,
    };
  }

  async claimDailyReport(day: string): Promise<boolean> {
    // Atomik: faqat bitta jarayon (yoki qayta ishga tushish) shu kun uchun "egallaydi"
    const res = await SettingsModel.updateOne({ _id: 'global', dailyReportLastDay: { $ne: day } }, { $set: { dailyReportLastDay: day } });
    if (res.modifiedCount === 1) return true;
    if (await SettingsModel.exists({ _id: 'global' })) return false;
    await SettingsModel.updateOne({ _id: 'global' }, { $setOnInsert: { dailyReportLastDay: day } }, { upsert: true });
    return true;
  }

  async update(changes: Partial<Settings>): Promise<Settings> {
    await SettingsModel.updateOne({ _id: 'global' }, { $set: changes }, { upsert: true });
    return this.get();
  }
}
