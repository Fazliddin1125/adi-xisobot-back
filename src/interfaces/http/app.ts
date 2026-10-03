import express, { Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { Container } from '../../container.js';
import { MANAGER_ROLES } from '../../domain/policies.js';
import { requireAuth, requireRole } from './middlewares/auth.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';

export function createApp(c: Container, corsOrigin?: string) {
  const app = express();
  // API web (nginx) konteyneri orqasida: haqiqiy IP X-Forwarded-For'dan olinadi (login blokirovkasi uchun)
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  // Sayt va API bitta manzilda (nginx /api) — CORS faqat alohida domen kerak bo'lsa yoqiladi
  if (corsOrigin) app.use(cors({ origin: corsOrigin.split(',').map((o) => o.trim()) }));
  // Choraklik hisobot tahriri katta bo'lishi mumkin (yuzlab bandlar); qolgan so'rovlar kichik
  const largeJson = express.json({ limit: '2mb' });
  const smallJson = express.json({ limit: '100kb' });
  app.use((req, res, next) => (req.path.startsWith('/api/reports/quarterly') ? largeJson : smallJson)(req, res, next));

  const api = Router();
  const auth = requireAuth(c.tokens, c.userRepo);
  const managers = requireRole(MANAGER_ROLES);
  const superadmin = requireRole(['superadmin']);

  api.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  api.post('/auth/login', c.authController.login);
  api.get('/auth/me', auth, c.authController.me);
  api.patch('/auth/password', auth, c.authController.changePassword);

  api.get('/settings', auth, c.settingsController.get);
  api.get('/departments', auth, c.departmentController.list);

  // Murojaatlar: xodim — o'ziniki, rahbarlar — hammasi (servis ichida)
  api.get('/appeals', auth, c.appealController.list);
  api.post('/appeals', auth, c.appealController.create);
  api.patch('/appeals/:id', auth, c.appealController.update);
  api.delete('/appeals/:id', auth, c.appealController.remove);

  api.get('/stats/summary', auth, c.statsController.summary);
  api.get('/stats', auth, c.statsController.details);

  // Topshiriqlar: ko'rish/o'zgartirish huquqlari servis ichida tekshiriladi
  api.get('/tasks', auth, c.taskController.list);
  api.post('/tasks', auth, c.taskController.create);
  api.get('/tasks/:id', auth, c.taskController.get);
  api.patch('/tasks/:id', auth, c.taskController.update);
  api.delete('/tasks/:id', auth, c.taskController.remove);
  api.patch('/tasks/:id/status', auth, c.taskController.changeStatus);
  api.post('/tasks/:id/comments', auth, c.taskController.addComment);

  // Rahbarlar: hisobotlar, Excel, xodimlar ro'yxati
  api.get('/reports/staff', auth, managers, c.statsController.perStaff);
  api.get('/reports/export', auth, managers, c.statsController.exportXlsx);
  api.get('/reports/quarterly/ai-status', auth, managers, c.quarterlyReportController.aiStatus);
  api.get('/reports/quarterly', auth, managers, c.quarterlyReportController.get);
  api.post('/reports/quarterly', auth, managers, c.quarterlyReportController.generate);
  api.patch('/reports/quarterly/:id', auth, managers, c.quarterlyReportController.update);
  api.get('/reports/quarterly/:id/docx', auth, managers, c.quarterlyReportController.docx);
  api.get('/users', auth, managers, c.userController.list);
  api.get('/users/:id', auth, managers, c.userController.get);

  // Superadmin: foydalanuvchilar, bo'limlar, sozlamalar
  const admin = Router();
  admin.use(auth, superadmin);
  admin.post('/users', c.userController.create);
  admin.patch('/users/:id', c.userController.update);
  admin.delete('/users/:id', c.userController.remove);
  admin.post('/users/:id/telegram-test', c.userController.telegramTest);
  admin.post('/departments', c.departmentController.create);
  admin.patch('/departments/:id', c.departmentController.update);
  admin.delete('/departments/:id', c.departmentController.remove);
  admin.patch('/settings', c.settingsController.update);
  api.use('/admin', admin);

  app.use('/api', api);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
