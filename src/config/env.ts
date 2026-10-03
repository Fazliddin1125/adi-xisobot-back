try {
  process.loadEnvFile();
} catch {
  // .env bo'lmasa, muhit o'zgaruvchilaridan foydalaniladi (Docker)
}

const isProduction = process.env.NODE_ENV === 'production';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Muhit o'zgaruvchisi topilmadi: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required('MONGO_URI', 'mongodb://localhost:27017/atm_murojaat'),
  jwtSecret: required('JWT_SECRET'),
  isProduction,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  /** Bo'sh — CORS o'chiq (sayt va API bitta manzilda). Alohida frontend domeni bo'lsa vergul bilan */
  corsOrigin: process.env.CORS_ORIGIN || undefined,
  appUrl: process.env.APP_URL?.replace(/\/$/, ''),
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || undefined,
    apiBase: process.env.TELEGRAM_API_BASE || 'https://api.telegram.org',
    /** Bot /start ga ID bilan javob bersinmi (bitta server nusxasida yoqing) */
    idBot: process.env.TELEGRAM_ID_BOT !== 'false',
    /** /start javobida kimga murojaat qilish (jo'nalish kelishigida), masalan "Fazliddinga (@fazliddin_bakhrom)" */
    supportContact: process.env.TELEGRAM_SUPPORT_CONTACT || 'ATM tizimi administratoriga',
  },
  ai: {
    /** Bo'sh bo'lsa — hisobot AI'siz qoralama sifatida tuziladi */
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
    model: process.env.AI_MODEL || 'claude-opus-5-5',
  },
  reportTemplatePath: process.env.REPORT_TEMPLATE_PATH || 'templates/chorak-hisoboti.docx',
  admin: {
    username: process.env.ADMIN_USERNAME ?? 'admin',
    // Production'da standart parol ishlatilmaydi — pastdagi tekshiruv
    password: process.env.ADMIN_PASSWORD ?? (isProduction ? '' : 'admin12345'),
    fullName: process.env.ADMIN_FULLNAME ?? 'Administrator',
  },
};

// Production'da xavfli standart qiymatlar bilan ishga tushmaymiz
if (isProduction) {
  if (env.jwtSecret.length < 32) throw new Error('JWT_SECRET kamida 32 belgidan iborat bo‘lishi kerak');
  if (env.admin.password.length < 8) throw new Error('ADMIN_PASSWORD berilmagan yoki 8 belgidan qisqa');
}
