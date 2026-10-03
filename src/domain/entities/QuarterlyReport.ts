/** Choraklik hisobotdagi bitta band va u qaysi manba yozuvlardan olingani (masalan ["I12", "I15", "T3"]) */
export interface ReportItem {
  text: string;
  sources: string[];
}

export interface ReportMonth {
  month: number; // 1–12
  name: string; // "Aprel"
  items: ReportItem[];
}

/** Hisobotning AI (yoki qoralama) yozadigan qismi — Word shablonidagi bo'limlar */
export interface ReportContent {
  summary: string; // "Umumiy ma’lumot"
  months: ReportMonth[]; // "Hisobot davrida bajarilgan asosiy ishlar"
  extra: ReportItem[]; // "Qo‘shimcha ishlar"
  conclusion: string[]; // "Xulosa" paragraflari
}

/** Tasdiq va imzo qatorlari — rahbar ko'rib chiqish sahifasida tahrirlaydi */
export interface ReportHeader {
  approverTitle: string; // "RTT Markazi boshlig‘i"
  approverName: string; // "M.D.Jo‘rayev"
  centerName: string; // "Raqamli ta’lim texnologiyalari markazi"
  departmentName: string; // "Tarmoqlarni boshqarish bo‘limi"
  signerTitle: string; // "Tarmoqlarni boshqarish bo‘limi boshlig‘i"
  signerName: string; // "A.Sharofuddinov"
}

/** Hisobot qaysi yozuvdan tuzilgani — ko'rib chiqishda manbani ko'rsatish uchun saqlanadi */
export interface ReportSource {
  ref: string; // "I12" — ish, "T3" — topshiriq
  kind: 'ish' | 'topshiriq';
  date: Date;
  text: string;
  author: string;
}

export type ReportStatus = 'generating' | 'ready' | 'failed';

export interface QuarterlyReport {
  id: string;
  departmentId: string;
  year: number;
  quarter: number; // 1–4
  status: ReportStatus;
  header: ReportHeader;
  content?: ReportContent;
  sources: ReportSource[];
  /** Matnni kim yozdi: Claude modeli yoki "qoralama" (AI ulanmagan) */
  writer?: string;
  error?: string;
  generatedById: string;
  generatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
