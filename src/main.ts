import { env } from './config/env.js';
import { buildContainer } from './container.js';
import { connectDatabase } from './infrastructure/db/connect.js';
import { runMigrations } from './infrastructure/db/migrations.js';
import { createApp } from './interfaces/http/app.js';

async function bootstrap() {
  await connectDatabase(env.mongoUri);
  await runMigrations();
  const container = buildContainer();

  if (await container.userService.ensureSuperadmin(env.admin.fullName, env.admin.username, env.admin.password)) {
    console.log(`Superadmin yaratildi: login "${env.admin.username}"`);
  }

  if (container.telegramIdBot) {
    container.telegramIdBot.start();
    console.log('Telegram bot ishga tushdi');
  } else if (!env.telegram.botToken) {
    console.log('TELEGRAM_BOT_TOKEN berilmagan — Telegram bildirishnomalari o\'chiq');
  }

  console.log(
    container.reportWriter.usesAi
      ? `Choraklik hisobot: AI yoqilgan (${container.reportWriter.name})`
      : 'ANTHROPIC_API_KEY berilmagan — choraklik hisobot AI\'siz qoralama sifatida tuziladi',
  );

  createApp(container, env.corsOrigin).listen(env.port, () => {
    console.log(`API ishga tushdi: http://localhost:${env.port}/api`);
  });
}

bootstrap().catch((err) => {
  console.error('Ishga tushirishda xatolik:', err);
  process.exit(1);
});
