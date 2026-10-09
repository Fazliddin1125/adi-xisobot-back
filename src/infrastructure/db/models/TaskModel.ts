import { Schema, Types, model, type InferSchemaType } from 'mongoose';
import { TASK_STATUSES, TASK_VISIBILITY } from '../../../domain/entities/Task.js';

const taskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    deadline: { type: Date, required: true },
    status: { type: String, enum: TASK_STATUSES, default: 'yangi', required: true },
    visibility: { type: String, enum: TASK_VISIBILITY, default: 'public', required: true },
    assigneeIds: [{ type: Types.ObjectId, ref: 'User', required: true }],
    creatorId: { type: Types.ObjectId, ref: 'User', required: true },
    completedAt: { type: Date },
    completedById: { type: Types.ObjectId, ref: 'User' },
    history: [
      {
        _id: false,
        status: { type: String, enum: TASK_STATUSES, required: true },
        byId: { type: Types.ObjectId, ref: 'User', required: true },
        at: { type: Date, required: true },
      },
    ],
  },
  { timestamps: true },
);

taskSchema.index({ assigneeIds: 1, status: 1 });
taskSchema.index({ creatorId: 1 });
taskSchema.index({ createdAt: 1 });
taskSchema.index({ completedAt: 1 });

// history — oddiy massiv sifatida (lean() natijasi), subdocument tiplarisiz
export type TaskDoc = Omit<InferSchemaType<typeof taskSchema>, 'history'> & {
  _id: unknown;
  history?: Array<{ status: (typeof TASK_STATUSES)[number]; byId: unknown; at: Date }>;
};
export const TaskModel = model('Task', taskSchema);

const taskCommentSchema = new Schema(
  {
    taskId: { type: Types.ObjectId, ref: 'Task', required: true, index: true },
    authorId: { type: Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type TaskCommentDoc = InferSchemaType<typeof taskCommentSchema> & { _id: unknown };
export const TaskCommentModel = model('TaskComment', taskCommentSchema);
