export const TASK_STATUSES = ['yangi', 'jarayonda', 'bajarildi'] as const;
export const TASK_VISIBILITY = ['public', 'private'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
/** public — barcha xodimlar ko'radi; private — faqat ijrochilar, topshiriq bergan va rahbarlar */
export type TaskVisibility = (typeof TASK_VISIBILITY)[number];

export interface Task {
  id: string;
  title: string;
  description?: string;
  deadline: Date;
  status: TaskStatus;
  visibility: TaskVisibility;
  assigneeIds: string[];
  creatorId: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type NewTask = Pick<Task, 'title' | 'description' | 'deadline' | 'visibility' | 'assigneeIds' | 'creatorId'>;
export type TaskChanges = Partial<Pick<Task, 'title' | 'description' | 'deadline' | 'visibility' | 'assigneeIds'>>;

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  text: string;
  createdAt: Date;
}

/** Ijrochi o'zi o'tkaza oladigan bosqichlar */
export const ASSIGNEE_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  yangi: ['jarayonda'],
  jarayonda: ['bajarildi'],
  bajarildi: [],
};

/** Bajarilgan topshiriqni orqaga qaytarish (izoh majburiy, ijrochiga xabar boradi) */
export function isReturn(from: TaskStatus, to: TaskStatus): boolean {
  return from === 'bajarildi' && to !== 'bajarildi';
}
