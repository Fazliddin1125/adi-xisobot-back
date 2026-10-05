import type { NewTask, Task, TaskChanges, TaskComment, TaskStatus } from '../entities/Task.js';

export interface TaskFilter {
  /** Berilsa — faqat shu foydalanuvchi ko'ra oladiganlar (ochiq + ijrochi/bergan bo'lganlari) */
  visibleTo?: string;
  /** Faqat shu foydalanuvchi ijrochi yoki bergan topshiriqlar */
  involving?: string;
  assigneeId?: string;
  /** Bajarilganlardan faqat shu sanadan keyin yakunlanganlar */
  doneSince?: Date;
  /** Faqat egasi yo'q umumiy ishlar (bajarilmaganlari) */
  unassigned?: boolean;
}

export interface TaskRepository {
  create(data: NewTask): Promise<Task>;
  findById(id: string): Promise<Task | null>;
  update(id: string, changes: TaskChanges): Promise<Task | null>;
  setStatus(id: string, status: TaskStatus, completedAt: Date | null): Promise<Task | null>;
  delete(id: string): Promise<void>;
  list(filter: TaskFilter): Promise<Task[]>;
  countByUser(userId: string): Promise<number>;
  /**
   * Umumiy ishni atomik qabul qilish: egasi yo'q va bajarilmagan bo'lsagina userId'ga beriladi.
   * Boshqasi oldinroq qabul qilgan bo'lsa — null.
   */
  claim(id: string, userId: string): Promise<Task | null>;
  /** Ijrochisi bor, bajarilmagan topshiriqlar — bandlikni hisoblash uchun */
  listActiveAssigned(): Promise<Task[]>;
  /** [from, to) oralig'ida bajarilgan va ijrochilardan kamida biri ro'yxatda bo'lgan topshiriqlar */
  listCompleted(filter: { from: Date; to: Date; assigneeIds: string[] }): Promise<Task[]>;
  addComment(taskId: string, authorId: string, text: string): Promise<TaskComment>;
  listComments(taskId: string): Promise<TaskComment[]>;
  countComments(taskIds: string[]): Promise<Record<string, number>>;
}
