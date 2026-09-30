import { AppError } from '../../domain/errors/AppError.js';
import {
  ASSIGNEE_TRANSITIONS,
  TASK_STATUSES,
  type Task,
  type TaskChanges,
  type TaskComment,
  type TaskStatus,
  type TaskVisibility,
} from '../../domain/entities/Task.js';
import { can } from '../../domain/policies.js';
import type { TaskRepository } from '../../domain/repositories/TaskRepository.js';
import type { UserRepository } from '../../domain/repositories/UserRepository.js';
import type { Actor } from '../Actor.js';
import type { NotificationService } from './NotificationService.js';

const DONE_VISIBLE_DAYS = 30;

export interface TaskInput {
  title: string;
  description?: string;
  deadline: Date;
  visibility: TaskVisibility;
  assigneeIds: string[];
}

export interface TaskListQuery {
  /** mine — faqat men ijrochi yoki bergan topshiriqlar */
  scope?: 'all' | 'mine';
  assigneeId?: string;
  /** Bajarilganlarning hammasini ko'rsatish (standart: oxirgi 30 kun) */
  includeArchive?: boolean;
}

interface PersonRef {
  id: string;
  fullName: string;
}

export interface TaskView extends Omit<Task, 'assigneeIds' | 'creatorId'> {
  assignees: PersonRef[];
  creator: PersonRef;
  overdue: boolean;
  commentsCount: number;
  canManage: boolean;
  /** Joriy foydalanuvchi o'tkaza oladigan bosqichlar */
  allowedStatuses: TaskStatus[];
}

export interface TaskCommentView extends TaskComment {
  authorName: string;
}

export class TaskService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly users: UserRepository,
    private readonly notifications: NotificationService,
  ) {}

  async list(actor: Actor, query: TaskListQuery): Promise<TaskView[]> {
    const doneSince = query.includeArchive ? undefined : new Date(Date.now() - DONE_VISIBLE_DAYS * 86_400_000);
    const tasks = await this.tasks.list({
      visibleTo: can.viewAll(actor.role) ? undefined : actor.id,
      involving: query.scope === 'mine' ? actor.id : undefined,
      assigneeId: query.assigneeId,
      doneSince,
    });
    return this.toViews(actor, tasks);
  }

  async get(actor: Actor, id: string): Promise<TaskView & { comments: TaskCommentView[] }> {
    const task = await this.getVisible(actor, id);
    const [view] = await this.toViews(actor, [task]);
    const comments = await this.tasks.listComments(id);
    const names = await this.nameMap(comments.map((c) => c.authorId));
    return { ...view, comments: comments.map((c) => ({ ...c, authorName: names.get(c.authorId) ?? '—' })) };
  }

  async create(actor: Actor, input: TaskInput): Promise<TaskView> {
    if (!can.createTask(actor.role)) throw AppError.forbidden('Topshiriq berish huquqi yo\'q');
    await this.assertAssignees(actor, input.assigneeIds);
    const task = await this.tasks.create({ ...input, creatorId: actor.id });
    void this.notifications.taskAssigned(task, task.assigneeIds);
    return (await this.toViews(actor, [task]))[0];
  }

  async update(actor: Actor, id: string, changes: TaskChanges): Promise<TaskView> {
    const task = await this.getVisible(actor, id);
    if (!this.canManage(actor, task)) throw AppError.forbidden('Bu topshiriqni o\'zgartira olmaysiz');
    if (changes.assigneeIds) await this.assertAssignees(actor, changes.assigneeIds);
    const updated = await this.tasks.update(id, changes);
    // Faqat yangi qo'shilgan ijrochilarga xabar
    const added = updated!.assigneeIds.filter((a) => !task.assigneeIds.includes(a));
    if (added.length) void this.notifications.taskAssigned(updated!, added);
    return (await this.toViews(actor, [updated!]))[0];
  }

  async changeStatus(actor: Actor, id: string, status: TaskStatus): Promise<TaskView> {
    const task = await this.getVisible(actor, id);
    if (!this.allowedStatuses(actor, task).includes(status)) {
      throw AppError.forbidden('Topshiriqni bu bosqichga o\'tkaza olmaysiz');
    }
    const updated = await this.tasks.setStatus(id, status, status === 'bajarildi' ? new Date() : null);
    return (await this.toViews(actor, [updated!]))[0];
  }

  async delete(actor: Actor, id: string): Promise<void> {
    const task = await this.getVisible(actor, id);
    if (!this.canManage(actor, task)) throw AppError.forbidden('Bu topshiriqni o\'chira olmaysiz');
    await this.tasks.delete(id);
  }

  async addComment(actor: Actor, id: string, text: string): Promise<TaskCommentView> {
    await this.getVisible(actor, id);
    const comment = await this.tasks.addComment(id, actor.id, text);
    const author = await this.users.findById(actor.id);
    return { ...comment, authorName: author?.fullName ?? '—' };
  }

  canView(actor: Actor, task: Task): boolean {
    return (
      can.viewAll(actor.role) ||
      task.visibility === 'public' ||
      task.creatorId === actor.id ||
      task.assigneeIds.includes(actor.id)
    );
  }

  /** Topshiriq bergan, markaz boshlig'i va superadmin boshqaradi */
  canManage(actor: Actor, task: Task): boolean {
    return can.manageAnyTask(actor.role) || task.creatorId === actor.id;
  }

  allowedStatuses(actor: Actor, task: Task): TaskStatus[] {
    if (this.canManage(actor, task)) return TASK_STATUSES.filter((s) => s !== task.status);
    if (task.assigneeIds.includes(actor.id)) return ASSIGNEE_TRANSITIONS[task.status];
    return [];
  }

  /** Ijrochilar mavjudligini tekshiradi. Rahbarlar istalgan bo'lim xodimiga topshiriq bera oladi */
  private async assertAssignees(_actor: Actor, assigneeIds: string[]) {
    const unique = [...new Set(assigneeIds)];
    const users = await this.users.findByIds(unique);
    if (users.length !== unique.length) throw AppError.badRequest('Ijrochilardan biri topilmadi');
  }

  private async getVisible(actor: Actor, id: string): Promise<Task> {
    const task = await this.tasks.findById(id);
    if (!task || !this.canView(actor, task)) throw AppError.notFound('Topshiriq topilmadi');
    return task;
  }

  private async nameMap(ids: string[]): Promise<Map<string, string>> {
    const users = await this.users.findByIds([...new Set(ids)]);
    return new Map(users.map((u) => [u.id, u.fullName]));
  }

  private async toViews(actor: Actor, tasks: Task[]): Promise<TaskView[]> {
    const names = await this.nameMap(tasks.flatMap((t) => [t.creatorId, ...t.assigneeIds]));
    const commentCounts = await this.tasks.countComments(tasks.map((t) => t.id));
    const now = Date.now();
    const ref = (id: string) => ({ id, fullName: names.get(id) ?? '—' });
    return tasks.map(({ assigneeIds, creatorId, ...t }) => {
      const task = { ...t, assigneeIds, creatorId };
      return {
        ...t,
        assignees: assigneeIds.map(ref),
        creator: ref(creatorId),
        overdue: t.status !== 'bajarildi' && t.deadline.getTime() < now,
        commentsCount: commentCounts[t.id] ?? 0,
        canManage: this.canManage(actor, task),
        allowedStatuses: this.allowedStatuses(actor, task),
      };
    });
  }
}
