import { Schema, Types, model, type InferSchemaType } from 'mongoose';
import { DELIVERY_KINDS } from '../../../domain/entities/Delivery.js';

const deliveryLogSchema = new Schema(
  {
    kind: { type: String, enum: DELIVERY_KINDS, required: true },
    title: { type: String, required: true },
    byName: { type: String },
    results: [
      {
        _id: false,
        userId: { type: Types.ObjectId, ref: 'User', required: true },
        fullName: { type: String, required: true },
        ok: { type: Boolean, required: true },
        reason: { type: String },
      },
    ],
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// 90 kundan eskilari avtomatik o'chadi
deliveryLogSchema.index({ createdAt: -1 });
deliveryLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 86_400 });

export type DeliveryLogDoc = Omit<InferSchemaType<typeof deliveryLogSchema>, 'results'> & {
  _id: unknown;
  results?: Array<{ userId: unknown; fullName: string; ok: boolean; reason?: string | null }>;
};
export const DeliveryLogModel = model('DeliveryLog', deliveryLogSchema);
