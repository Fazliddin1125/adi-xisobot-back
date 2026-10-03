import { Schema, Types, model, type InferSchemaType } from 'mongoose';

const itemSchema = new Schema({ text: { type: String, required: true }, sources: [String] }, { _id: false });

const reportSchema = new Schema(
  {
    departmentId: { type: Types.ObjectId, ref: 'Department', required: true },
    year: { type: Number, required: true },
    quarter: { type: Number, required: true, min: 1, max: 4 },
    status: { type: String, enum: ['generating', 'ready', 'failed'], required: true },
    header: {
      approverTitle: String,
      approverName: String,
      centerName: String,
      departmentName: String,
      signerTitle: String,
      signerName: String,
    },
    content: {
      type: new Schema(
        {
          summary: String,
          months: [new Schema({ month: Number, name: String, items: [itemSchema] }, { _id: false })],
          extra: [itemSchema],
          conclusion: [String],
        },
        { _id: false },
      ),
      default: undefined,
    },
    sources: [
      new Schema(
        { ref: String, kind: { type: String, enum: ['ish', 'topshiriq'] }, date: Date, text: String, author: String },
        { _id: false },
      ),
    ],
    writer: String,
    error: String,
    generatedById: { type: Types.ObjectId, ref: 'User', required: true },
    generatedAt: Date,
  },
  { timestamps: true },
);

// Bir bo'lim uchun bir chorakda bitta hisobot
reportSchema.index({ departmentId: 1, year: 1, quarter: 1 }, { unique: true });

export type QuarterlyReportDoc = InferSchemaType<typeof reportSchema> & { _id: unknown; createdAt: Date; updatedAt: Date };
export const QuarterlyReportModel = model('QuarterlyReport', reportSchema);
