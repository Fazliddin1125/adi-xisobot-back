import { AppealModel } from './models/AppealModel.js';
import { UserModel } from './models/UserModel.js';

/** Eski versiyadagi ma'lumotlarni yangi tuzilmaga o'tkazish (har ishga tushganda, takroriy xavfsiz) */
export async function runMigrations(): Promise<void> {
  const collection = UserModel.collection;
  const a = await collection.updateMany({ role: 'admin' }, { $set: { role: 'superadmin' } });
  const s = await collection.updateMany({ role: 'staff' }, { $set: { role: 'xodim' } });
  if (a.modifiedCount || s.modifiedCount) {
    console.log(`Migratsiya: ${a.modifiedCount} admin → superadmin, ${s.modifiedCount} staff → xodim`);
  }

  // "Murojaatchi ismi" → "Murojaat nomi"
  const r = await AppealModel.collection.updateMany({ visitorName: { $exists: true } }, { $rename: { visitorName: 'title' } });
  if (r.modifiedCount) console.log(`Migratsiya: ${r.modifiedCount} murojaatda visitorName → title`);
}
