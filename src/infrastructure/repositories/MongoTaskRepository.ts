import { Types, isValidObjectId } from 'mongoose';
import type { NewTask, Task, TaskChanges, TaskComment, TaskStatus } from '../../domain/entities/Task.js';
import type { TaskFilter, TaskRepository } from '../../domain/repositories/TaskRepository.js';
import { TaskCommentModel, TaskModel, type TaskCommentDoc, type TaskDoc } from '../db/models/TaskModel.js';

function toEntity(doc: TaskDoc): Task {
  return {
    id: String(doc._id),
    title: doc.title,
    description: doc.description ?? undefined,
    deadline: doc.deadline,
    status: doc.status,
    visibility: doc.visibility,
    assigneeIds: doc.assigneeIds.map(String),
    creatorId: String(doc.creatorId),
    completedAt: doc.completedAt ?? undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

const toComment = (doc: TaskCommentDoc): TaskComment => ({
  id: String(doc._id),
  taskId: String(doc.taskId),
  authorId: String(doc.authorId),
  text: doc.text,
  createdAt: doc.createdAt,
});

const oid = (id: string) => new Types.ObjectId(id);

export class MongoTaskRepository implements TaskRepository {
  async create(data: NewTask): Promise<Task> {
    return toEntity((await TaskModel.create(data)).toObject());
  }

  async findById(id: string): Promise<Task | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await TaskModel.findById(id).lean();
    return doc ? toEntity(doc) : null;
  }

  async update(id: string, changes: TaskChanges): Promise<Task | null> {
    const { description, ...rest } = changes;
    const update =
      description === undefined ? rest : description === '' ? { ...rest, $unset: { description: 1 } } : { ...rest, description };
    const doc = await TaskModel.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();
    return doc ? toEntity(doc) : null;
  }

  async setStatus(id: string, status: TaskStatus, completedAt: Date | null): Promise<Task | null> {
    const update = completedAt ? { status, completedAt } : { status, $unset: { completedAt: 1 } };
    const doc = await TaskModel.findByIdAndUpdate(id, update, { new: true }).lean();
    return doc ? toEntity(doc) : null;
  }

  async delete(id: string): Promise<void> {
    await Promise.all([TaskModel.findByIdAndDelete(id), TaskCommentModel.deleteMany({ taskId: oid(id) })]);
  }

  async list(filter: TaskFilter): Promise<Task[]> {
    const and: object[] = [];
    if (filter.visibleTo) {
      const me = oid(filter.visibleTo);
      and.push({ $or: [{ visibility: 'public' }, { assigneeIds: me }, { creatorId: me }] });
    }
    if (filter.involving) {
      const me = oid(filter.involving);
      and.push({ $or: [{ assigneeIds: me }, { creatorId: me }] });
    }
    if (filter.assigneeId) and.push({ assigneeIds: oid(filter.assigneeId) });
    if (filter.doneSince) and.push({ $or: [{ status: { $ne: 'bajarildi' } }, { completedAt: { $gte: filter.doneSince } }] });

    const docs = await TaskModel.find(and.length ? { $and: and } : {}).sort({ deadline: 1 }).lean();
    return docs.map(toEntity);
  }

  async countByUser(userId: string): Promise<number> {
    const me = oid(userId);
    return TaskModel.countDocuments({ $or: [{ assigneeIds: me }, { creatorId: me }] });
  }

  async listCompleted({ from, to, assigneeIds }: { from: Date; to: Date; assigneeIds: string[] }): Promise<Task[]> {
    const docs = await TaskModel.find({
      status: 'bajarildi',
      completedAt: { $gte: from, $lt: to },
      assigneeIds: { $in: assigneeIds.map(oid) },
    })
      .sort({ completedAt: 1 })
      .lean();
    return docs.map(toEntity);
  }

  async addComment(taskId: string, authorId: string, text: string): Promise<TaskComment> {
    return toComment((await TaskCommentModel.create({ taskId, authorId, text })).toObject());
  }

  async listComments(taskId: string): Promise<TaskComment[]> {
    return (await TaskCommentModel.find({ taskId: oid(taskId) }).sort({ createdAt: 1 }).lean()).map(toComment);
  }

  async countComments(taskIds: string[]): Promise<Record<string, number>> {
    if (!taskIds.length) return {};
    const rows = await TaskCommentModel.aggregate([
      { $match: { taskId: { $in: taskIds.map(oid) } } },
      { $group: { _id: '$taskId', n: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((r) => [String(r._id), r.n]));
  }
}
