import { Schema, model } from 'mongoose';

/** Yagona hujjat: _id = 'global' */
const settingsSchema = new Schema({
  _id: { type: String, default: 'global' },
  appealStatusEnabled: { type: Boolean, default: true },
  visitorTypeEnabled: { type: Boolean, default: true },
  channelEnabled: { type: Boolean, default: true },
  reportGenerationEnabled: { type: Boolean, default: true },
  dailyReportEnabled: { type: Boolean, default: true },
  /** Kunlik hisobot oxirgi yuborilgan kun ("YYYY-MM-DD") — qayta ishga tushganda ikki marta yubormaslik uchun */
  dailyReportLastDay: { type: String, default: null },
});

export const SettingsModel = model('Settings', settingsSchema);
