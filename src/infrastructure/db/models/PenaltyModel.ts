import { Schema, Types, model, type InferSchemaType } from 'mongoose';

const penaltySchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true },
    points: { type: Number, required: true },
    reason: { type: String, required: true },
    notifiedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Bir kun uchun bitta jarima
penaltySchema.index({ userId: 1, day: 1 }, { unique: true });
penaltySchema.index({ notifiedAt: 1 });

export type PenaltyDoc = InferSchemaType<typeof penaltySchema> & { _id: unknown };
export const PenaltyModel = model('Penalty', penaltySchema);
