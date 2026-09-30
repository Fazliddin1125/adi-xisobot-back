import type { Role } from './entities/User.js';

/** Rahbarlar: barcha murojaat, statistika va topshiriqlarni ko'radi, Excel yuklaydi, topshiriq beradi */
export const MANAGER_ROLES: Role[] = ['superadmin', 'markaz_boshligi', 'bolim_boshligi'];

export const can = {
  viewAll: (role: Role) => MANAGER_ROLES.includes(role),
  exportReports: (role: Role) => MANAGER_ROLES.includes(role),
  createTask: (role: Role) => MANAGER_ROLES.includes(role),
  /** Istalgan topshiriqni tahrirlash/o'chirish/qabul qilish (o'zi bermagan bo'lsa ham) */
  manageAnyTask: (role: Role) => role === 'superadmin' || role === 'markaz_boshligi',
  /** Istalgan kunning istalgan murojaatini tahrirlash */
  editAnyAppeal: (role: Role) => role === 'superadmin',
  administer: (role: Role) => role === 'superadmin',
};
