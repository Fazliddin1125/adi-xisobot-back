# adi-xisobot-back

ADU ATM bo'limi — murojaatlar va topshiriqlar tizimining backend qismi.

**Texnologiyalar:** Node.js, Express 5, TypeScript, MongoDB (Mongoose), Clean Architecture, Zod, JWT, ExcelJS, Telegram Bot API.

## Ishga tushirish

```bash
cp .env.example .env      # JWT_SECRET, ADMIN_PASSWORD va boshqalarni to'ldiring
npm install
npm run dev               # http://localhost:4100/api
```

MongoDB kerak (masalan: `docker run -d -p 127.0.0.1:27018:27017 mongo:7`, `.env` da `MONGO_URI`).

- Birinchi superadmin `.env` dagi `ADMIN_USERNAME` / `ADMIN_PASSWORD` bilan baza bo'sh bo'lganda yaratiladi.
- Telegram bildirishnomalari uchun `.env` ga `TELEGRAM_BOT_TOKEN` va `APP_URL` yozing.
- Sinov ma'lumotlari: `npm run seed:demo` (faqat sinov bazasida!).

Production: `npm run build && npm start` yoki `Dockerfile`.

## Tuzilish

```
src/
  domain/          entity'lar, repository interfeyslari, rollar ruxsatlari (policies.ts)
  application/     biznes-logika servislari va portlar
  infrastructure/  MongoDB, bcrypt, JWT, Excel, Telegram
  interfaces/      Express (HTTP) va Telegram bot
  container.ts     bog'liqliklarni ulash
  shared/time.ts   Toshkent vaqti bo'yicha kun/hafta/oy
```
