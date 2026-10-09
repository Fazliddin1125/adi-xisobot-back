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
    completedById: doc.completedById ? String(doc.completedById) : undefined,
    history: (doc.history ?? []).map((e) => ({ status: e.status, byId: String(e.byId), at: e.at })),
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
    const history = [{ status: 'yangi', byId: data.creatorId, at: new Date() }];
    return toEntity((await TaskModel.create({ ...data, history })).toObject());
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

  async setStatus(id: string, status: TaskStatus, actorId: string): Promise<Task | null> {
    const at = new Date();
    const push = { $push: { history: { status, byId: oid(actorId), at } } };
    const update =
      status === 'bajarildi'
        ? { $set: { status, completedAt: at, completedById: oid(actorId) }, ...push }
        : { $set: { status }, $unset: { completedAt: 1, completedById: 1 }, ...push };
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
    if (filter.unassigned) and.push({ 'assigneeIds.0': { $exists: false }, status: { $ne: 'bajarildi' } });

    const docs = await TaskModel.find(and.length ? { $and: and } : {}).sort({ deadline: 1 }).lean();
    return docs.map(toEntity);
  }

  async claim(id: string, userId: string): Promise<Task | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await TaskModel.findOneAndUpdate(
      { _id: id, 'assigneeIds.0': { $exists: false }, status: { $ne: 'bajarildi' } },
      {
        $set: { assigneeIds: [oid(userId)], status: 'jarayonda' },
        $push: { history: { status: 'jarayonda', byId: oid(userId), at: new Date() } },
      },
      { new: true },
    ).lean();
    return doc ? toEntity(doc) : null;
  }

  async listActiveAssigned(): Promise<Task[]> {
    const docs = await TaskModel.find({ status: { $ne: 'bajarildi' }, 'assigneeIds.0': { $exists: true } })
      .sort({ deadline: 1 })
      .lean();
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

  async listCreated({ from, to }: { from: Date; to: Date }): Promise<Task[]> {
    const docs = await TaskModel.find({ createdAt: { $gte: from, $lt: to } }).sort({ createdAt: 1 }).lean();
    return docs.map(toEntity);
  }

  async listCompletedBetween({ from, to }: { from: Date; to: Date }): Promise<Task[]> {
    const docs = await TaskModel.find({ status: 'bajarildi', completedAt: { $gte: from, $lt: to } }).sort({ completedAt: 1 }).lean();
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
