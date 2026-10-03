import { env } from './config/env.js';
import { AuthService } from './application/services/AuthService.js';
import { UserService } from './application/services/UserService.js';
import { AppealService } from './application/services/AppealService.js';
import { StatsService } from './application/services/StatsService.js';
import { ExportService } from './application/services/ExportService.js';
import { TaskService } from './application/services/TaskService.js';
import { DepartmentService } from './application/services/DepartmentService.js';
import { SettingsService } from './application/services/SettingsService.js';
import { NotificationService } from './application/services/NotificationService.js';
import { QuarterlyReportService } from './application/services/QuarterlyReportService.js';
import { MongoQuarterlyReportRepository } from './infrastructure/repositories/MongoQuarterlyReportRepository.js';
import { ClaudeReportWriter } from './infrastructure/ai/ClaudeReportWriter.js';
import { DraftReportWriter } from './infrastructure/ai/DraftReportWriter.js';
import { DocxReportRenderer } from './infrastructure/export/DocxReportRenderer.js';
import { QuarterlyReportController } from './interfaces/http/controllers/QuarterlyReportController.js';
import { TelegramApi } from './infrastructure/telegram/TelegramApi.js';
import { DisabledMessageSender, TelegramMessageSender } from './infrastructure/telegram/TelegramMessageSender.js';
import { TelegramIdBot } from './interfaces/telegram/TelegramIdBot.js';
import { MongoUserRepository } from './infrastructure/repositories/MongoUserRepository.js';
import { MongoAppealRepository } from './infrastructure/repositories/MongoAppealRepository.js';
import { MongoTaskRepository } from './infrastructure/repositories/MongoTaskRepository.js';
import { MongoDepartmentRepository } from './infrastructure/repositories/MongoDepartmentRepository.js';
import { MongoSettingsRepository } from './infrastructure/repositories/MongoSettingsRepository.js';
import { BcryptPasswordHasher } from './infrastructure/security/BcryptPasswordHasher.js';
import { JwtTokenService } from './infrastructure/security/JwtTokenService.js';
import { ExcelReportExporter } from './infrastructure/export/ExcelReportExporter.js';
import { AuthController } from './interfaces/http/controllers/AuthController.js';
import { AppealController } from './interfaces/http/controllers/AppealController.js';
import { StatsController } from './interfaces/http/controllers/StatsController.js';
import { UserController } from './interfaces/http/controllers/UserController.js';
import { TaskController } from './interfaces/http/controllers/TaskController.js';
import { DepartmentController } from './interfaces/http/controllers/DepartmentController.js';
import { SettingsController } from './interfaces/http/controllers/SettingsController.js';

/** Composition root: barcha bog'liqliklar shu yerda ulanadi */
export function buildContainer() {
  const userRepo = new MongoUserRepository();
  const appealRepo = new MongoAppealRepository();
  const taskRepo = new MongoTaskRepository();
  const departmentRepo = new MongoDepartmentRepository();
  const settingsRepo = new MongoSettingsRepository();
  const hasher = new BcryptPasswordHasher();
  const tokens = new JwtTokenService(env.jwtSecret, env.jwtExpiresIn);
  const telegramApi = env.telegram.botToken ? new TelegramApi(env.telegram.botToken, env.telegram.apiBase) : null;
  const sender = telegramApi ? new TelegramMessageSender(telegramApi) : new DisabledMessageSender();
  const notificationService = new NotificationService(sender, userRepo, env.appUrl);
  const reportWriter = env.ai.anthropicApiKey ? new ClaudeReportWriter(env.ai.anthropicApiKey, env.ai.model) : new DraftReportWriter();
  const quarterlyReportService = new QuarterlyReportService(
    new MongoQuarterlyReportRepository(),
    appealRepo,
    taskRepo,
    userRepo,
    departmentRepo,
    reportWriter,
    new DocxReportRenderer(env.reportTemplatePath),
  );

  const authService = new AuthService(userRepo, hasher, tokens);
  const userService = new UserService(userRepo, appealRepo, taskRepo, departmentRepo, hasher);
  const appealService = new AppealService(appealRepo, userRepo, settingsRepo);
  const statsService = new StatsService(appealRepo, userRepo, departmentRepo);
  const exportService = new ExportService(appealRepo, userRepo, settingsRepo, statsService, new ExcelReportExporter());

  return {
    userRepo,
    tokens,
    userService,
    authController: new AuthController(authService),
    appealController: new AppealController(appealService),
    statsController: new StatsController(statsService, exportService),
    userController: new UserController(userService, notificationService),
    telegramIdBot:
      telegramApi && env.telegram.idBot
        ? new TelegramIdBot(telegramApi, async (chatId) => (await userRepo.findByTelegramId(chatId))?.fullName ?? null, env.telegram.supportContact)
        : null,
    taskController: new TaskController(new TaskService(taskRepo, userRepo, notificationService)),
    departmentController: new DepartmentController(new DepartmentService(departmentRepo, userRepo)),
    settingsController: new SettingsController(new SettingsService(settingsRepo)),
    quarterlyReportController: new QuarterlyReportController(quarterlyReportService),
    reportWriter,
  };
}

export type Container = ReturnType<typeof buildContainer>;
