import type { NewTask, Task, TaskChanges, TaskComment, TaskStatus } from '../entities/Task.js';

export interface TaskFilter {
  /** Berilsa — faqat shu foydalanuvchi ko'ra oladiganlar (ochiq + ijrochi/bergan bo'lganlari) */
  visibleTo?: string;
  /** Faqat shu foydalanuvchi ijrochi yoki bergan topshiriqlar */
  involving?: string;
  assigneeId?: string;
  /** Bajarilganlardan faqat shu sanadan keyin yakunlanganlar */
  doneSince?: Date;
}

export interface TaskRepository {
  create(data: NewTask): Promise<Task>;
  findById(id: string): Promise<Task | null>;
  update(id: string, changes: TaskChanges): Promise<Task | null>;
  setStatus(id: string, status: TaskStatus, completedAt: Date | null): Promise<Task | null>;
  delete(id: string): Promise<void>;
  list(filter: TaskFilter): Promise<Task[]>;
  countByUser(userId: string): Promise<number>;
  addComment(taskId: string, authorId: string, text: string): Promise<TaskComment>;
  listComments(taskId: string): Promise<TaskComment[]>;
  countComments(taskIds: string[]): Promise<Record<string, number>>;
}
