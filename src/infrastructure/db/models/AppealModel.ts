import { Schema, Types, model, type InferSchemaType } from 'mongoose';
import { CHANNELS, STATUSES, VISITOR_TYPES } from '../../../domain/entities/Appeal.js';

const appealSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    visitorType: { type: String, enum: VISITOR_TYPES },
    channel: { type: String, enum: CHANNELS },
    status: { type: String, enum: STATUSES },
    comment: { type: String, trim: true },
    staffId: { type: Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

appealSchema.index({ staffId: 1, createdAt: -1 });
appealSchema.index({ createdAt: -1 });

export type AppealDoc = InferSchemaType<typeof appealSchema> & { _id: unknown };
export const AppealModel = model('Appeal', appealSchema);
