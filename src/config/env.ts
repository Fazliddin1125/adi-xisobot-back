try {
  process.loadEnvFile();
} catch {
  // .env bo'lmasa, muhit o'zgaruvchilaridan foydalaniladi (Docker)
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Muhit o'zgaruvchisi topilmadi: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required('MONGO_URI', 'mongodb://localhost:27017/atm_murojaat'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  appUrl: process.env.APP_URL?.replace(/\/$/, ''),
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || undefined,
    apiBase: process.env.TELEGRAM_API_BASE || 'https://api.telegram.org',
    /** Bot /start ga ID bilan javob bersinmi (bitta server nusxasida yoqing) */
    idBot: process.env.TELEGRAM_ID_BOT !== 'false',
    /** /start javobida kimga murojaat qilish (jo'nalish kelishigida), masalan "Fazliddinga (@fazliddin_bakhrom)" */
    supportContact: process.env.TELEGRAM_SUPPORT_CONTACT || 'ATM tizimi administratoriga',
  },
  admin: {
    username: process.env.ADMIN_USERNAME ?? 'admin',
    password: process.env.ADMIN_PASSWORD ?? 'admin12345',
    fullName: process.env.ADMIN_FULLNAME ?? 'Administrator',
  },
};
