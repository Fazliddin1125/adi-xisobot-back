/**
 * Sinov uchun demo bo'limlar, xodimlar, oxirgi 60 kunlik murojaatlar va topshiriqlar yaratadi.
 * Ishga tushirish: npm run seed:demo  (faqat bo'sh/sinov bazada!)
 */
import { env } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../infrastructure/db/connect.js';
import { runMigrations } from '../infrastructure/db/migrations.js';
import { AppealModel } from '../infrastructure/db/models/AppealModel.js';
import { DepartmentModel } from '../infrastructure/db/models/DepartmentModel.js';
import { TaskModel } from '../infrastructure/db/models/TaskModel.js';
import { UserModel } from '../infrastructure/db/models/UserModel.js';
import { BcryptPasswordHasher } from '../infrastructure/security/BcryptPasswordHasher.js';
import { CHANNELS, STATUSES, VISITOR_TYPES } from '../domain/entities/Appeal.js';
import type { Role } from '../domain/entities/User.js';

const DEPARTMENTS = ['Axborot tizimlari bo\'limi', 'Masofaviy ta\'lim bo\'limi'];
const STAFF: Array<[string, string, Role, number | null]> = [
  ['Rasulov Bahodir', 'markaz', 'markaz_boshligi', null],
  ['Nazarov Sherzod', 'bolim1', 'bolim_boshligi', 0],
  ['Aliyev Vali', 'vali', 'xodim', 0],
  ['Karimova Dilnoza', 'dilnoza', 'xodim', 0],
  ['Rahimov Jasur', 'jasur', 'xodim', 1],
];
const NAMES = ['Karimov Anvar', 'Tosheva Malika', 'Yusupov Bekzod', 'Ergasheva Nilufar', 'Qodirov Sardor', '3-bino, 2-qavat — Wi-Fi ishlamayapti', '1-bino, 105-xona — proyektor'];
const COMMENTS = ['HEMIS tizimiga kira olmadi', 'LMS da topshiriq yuklanmadi', 'Test saytida tugma ishlamaydi', 'Parolni tiklash', '', ''];
const pick = <T>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];

await connectDatabase(env.mongoUri);
await runMigrations();
const hasher = new BcryptPasswordHasher();

const deptIds = [];
for (const name of DEPARTMENTS) {
  deptIds.push(((await DepartmentModel.findOne({ name })) ?? (await DepartmentModel.create({ name })))._id);
}

const users: Record<string, unknown> = {};
for (const [fullName, username, role, dept] of STAFF) {
  const departmentId = dept === null ? null : deptIds[dept];
  const user = await UserModel.findOneAndUpdate(
    { username },
    { $set: { fullName, role, departmentId }, $setOnInsert: { passwordHash: await hasher.hash('123456') } },
    { upsert: true, new: true },
  );
  users[username] = user._id;
}
const receivers = Object.values(users);

const docs = [];
const now = Date.now();
for (let day = 0; day < 60; day++) {
  for (let i = 0; i < Math.floor(Math.random() * 7); i++) {
    const createdAt = new Date(now - day * 86_400_000 - Math.random() * 8 * 3_600_000);
    docs.push({
      title: pick(NAMES),
      visitorType: pick(VISITOR_TYPES),
      channel: pick(CHANNELS),
      status: Math.random() < 0.85 ? STATUSES[0] : STATUSES[1],
      comment: pick(COMMENTS) || undefined,
      staffId: pick(receivers),
      createdAt,
      updatedAt: createdAt,
    });
  }
}
await AppealModel.insertMany(docs, { timestamps: false } as never);

const day = (n: number) => new Date(now + n * 86_400_000);
await TaskModel.insertMany([
  { title: 'LMS test rejimidagi kamchiliklar ro\'yxatini tayyorlash', description: 'Murojaatlardan kelgan kamchiliklarni jamlab, dasturchilarga yuborish.', deadline: day(3), status: 'jarayonda', visibility: 'public', assigneeIds: [users.vali, users.dilnoza], creatorId: users.bolim1 },
  { title: 'HEMIS parol tiklash yo\'riqnomasi', description: 'Talabalar uchun qisqa video va PDF yo\'riqnoma.', deadline: day(7), status: 'yangi', visibility: 'public', assigneeIds: [users.dilnoza], creatorId: users.bolim1 },
  { title: 'Oylik hisobotni tayyorlash', deadline: day(-1), status: 'yangi', visibility: 'private', assigneeIds: [users.jasur], creatorId: users.markaz },
  { title: 'Kompyuter sinfini tekshirish', deadline: day(1), status: 'tekshiruvda', visibility: 'public', assigneeIds: [users.vali], creatorId: users.markaz },
  { title: 'Wi-Fi nuqtalarini xatlovdan o\'tkazish', deadline: day(-5), status: 'bajarildi', completedAt: day(-6), visibility: 'public', assigneeIds: [users.jasur], creatorId: users.markaz },
]);

console.log(`${STAFF.length} foydalanuvchi (parol: 123456), ${docs.length} murojaat, 5 topshiriq qo'shildi`);
await disconnectDatabase();
