import { Schema, model, type InferSchemaType } from 'mongoose';

const departmentSchema = new Schema({ name: { type: String, required: true, unique: true, trim: true } }, { timestamps: true });

export type DepartmentDoc = InferSchemaType<typeof departmentSchema> & { _id: unknown };
export const DepartmentModel = model('Department', departmentSchema);
