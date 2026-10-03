import { z } from 'zod';
import { CHANNELS, STATUSES, VISITOR_TYPES } from '../../../domain/entities/Appeal.js';
import { ROLES } from '../../../domain/entities/User.js';
import { TASK_STATUSES, TASK_VISIBILITY } from '../../../domain/entities/Task.js';

const password = z.string().min(6, 'Parol kamida 6 belgidan iborat bo\'lsin').max(100);
const username = z
  .string()
  .trim()
  .min(3, 'Login kamida 3 belgi')
  .max(32)
  .regex(/^[a-zA-Z0-9._-]+$/, 'Login faqat lotin harflari, raqam va . _ - dan iborat bo\'lsin');
const fullName = z.string().trim().min(2, 'F.I.Sh kamida 2 belgi').max(120);
/** Telegram chat ID: foydalanuvchi uchun musbat, guruh uchun manfiy son */
const telegramId = z
  .string()
  .trim()
  .regex(/^-?\d{5,15}$/, 'Telegram ID faqat raqamlardan iborat bo\'lishi kerak (masalan 123456789)')
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null));
const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Noto\'g\'ri ID');

export const loginSchema = z.object({ username: z.string().trim().min(1), password: z.string().min(1) });

export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: password });

export const createUserSchema = z.object({
  fullName,
  username,
  password,
  role: z.enum(ROLES).default('xodim'),
  departmentId: objectId.nullable().optional(),
  telegramId,
});

export const updateUserSchema = z.object({
  fullName: fullName.optional(),
  username: username.optional(),
  password: password.optional(),
  role: z.enum(ROLES).optional(),
  departmentId: objectId.nullable().optional(),
  telegramId,
});

export const departmentSchema = z.object({ name: z.string().trim().min(2, 'Bo\'lim nomi kamida 2 belgi').max(120) });

export const settingsSchema = z.object({
  appealStatusEnabled: z.boolean().optional(),
  visitorTypeEnabled: z.boolean().optional(),
  channelEnabled: z.boolean().optional(),
  reportGenerationEnabled: z.boolean().optional(),
});

export const createAppealSchema = z.object({
  title: z.string().trim().min(2, 'Ish nomi kamida 2 belgi').max(200),
  // Majburiyligi sozlamaga bog'liq — servisda tekshiriladi
  visitorType: z.enum(VISITOR_TYPES).optional(),
  channel: z.enum(CHANNELS).optional(),
  status: z.enum(STATUSES).optional(),
  comment: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export const updateAppealSchema = z.object({
  title: z.string().trim().min(2, 'Ish nomi kamida 2 belgi').max(200).optional(),
  visitorType: z.enum(VISITOR_TYPES).optional(),
  channel: z.enum(CHANNELS).optional(),
  status: z.enum(STATUSES).optional(),
  /** Bo'sh satr izohni o'chiradi */
  comment: z.string().trim().max(1000).optional(),
});

export const periodQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month']).optional(),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Oy formati YYYY-MM bo\'lishi kerak')
    .optional(),
  staffId: objectId.optional(),
  departmentId: objectId.optional(),
});

/** "YYYY-MM-DD" → Toshkent vaqti bo'yicha o'sha kunning oxiri (23:59:59) */
const deadline = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Muddat formati YYYY-MM-DD bo\'lishi kerak')
  .transform((v) => new Date(`${v}T23:59:59+05:00`))
  .refine((d) => !Number.isNaN(d.getTime()), 'Muddat noto\'g\'ri');

export const createTaskSchema = z.object({
  title: z.string().trim().min(3, 'Sarlavha kamida 3 belgi').max(200),
  description: z
    .string()
    .trim()
    .max(5000)
    .optional()
    .transform((v) => (v ? v : undefined)),
  deadline,
  visibility: z.enum(TASK_VISIBILITY).default('public'),
  assigneeIds: z.array(objectId).min(1, 'Kamida bitta ijrochi tanlang').max(20),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  deadline: deadline.optional(),
  visibility: z.enum(TASK_VISIBILITY).optional(),
  assigneeIds: z.array(objectId).min(1, 'Kamida bitta ijrochi tanlang').max(20).optional(),
});

export const taskStatusSchema = z.object({
  status: z.enum(TASK_STATUSES),
  /** Bajarilganni qaytarishda majburiy (servisda tekshiriladi) */
  comment: z.string().trim().max(2000).optional(),
});
export const taskCommentSchema = z.object({ text: z.string().trim().min(1, 'Izoh bo\'sh').max(2000) });
export const taskListQuerySchema = z.object({
  scope: z.enum(['all', 'mine']).optional(),
  assigneeId: objectId.optional(),
  includeArchive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export const idParamSchema = z.object({ id: objectId });

const year = z.coerce.number().int().min(2020).max(2100);
const quarter = z.coerce.number().int().min(1, 'Chorak 1–4 bo‘lishi kerak').max(4, 'Chorak 1–4 bo‘lishi kerak');

export const quarterlyQuerySchema = z.object({ departmentId: objectId, year, quarter });

const reportItem = z.object({ text: z.string().trim().min(1).max(3000), sources: z.array(z.string().max(10)).max(500) });
export const quarterlyUpdateSchema = z.object({
  header: z
    .object({
      approverTitle: z.string().trim().max(200),
      approverName: z.string().trim().max(200),
      centerName: z.string().trim().max(300),
      departmentName: z.string().trim().max(300),
      signerTitle: z.string().trim().max(300),
      signerName: z.string().trim().max(200),
    })
    .optional(),
  content: z
    .object({
      summary: z.string().trim().max(5000),
      months: z.array(z.object({ month: z.number().int().min(1).max(12), name: z.string().max(30), items: z.array(reportItem).max(200) })).max(3),
      extra: z.array(reportItem).max(200),
      conclusion: z.array(z.string().trim().min(1).max(5000)).max(10),
    })
    .optional(),
});
