import { Schema, Types, model, type InferSchemaType } from 'mongoose';
import { ROLES } from '../../../domain/entities/User.js';

const userSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    tokenVersion: { type: Number, default: 0 },
    role: { type: String, enum: ROLES, default: 'xodim', required: true },
    departmentId: { type: Types.ObjectId, ref: 'Department', default: null },
    telegramId: { type: String, default: null, trim: true },
    vacationFrom: { type: String, default: null },
    vacationTo: { type: String, default: null },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: unknown };
export const UserModel = model('User', userSchema);
