import { Schema, model } from 'mongoose';

/** Yagona hujjat: _id = 'global' */
const settingsSchema = new Schema({
  _id: { type: String, default: 'global' },
  appealStatusEnabled: { type: Boolean, default: true },
  visitorTypeEnabled: { type: Boolean, default: true },
  channelEnabled: { type: Boolean, default: true },
  reportGenerationEnabled: { type: Boolean, default: true },
});

export const SettingsModel = model('Settings', settingsSchema);
