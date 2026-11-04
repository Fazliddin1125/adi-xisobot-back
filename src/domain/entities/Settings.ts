/** Superadmin boshqaradigan umumiy sozlamalar */
export interface Settings {
  /** "Hal qilindi / hal qilinmadi" */
  appealStatusEnabled: boolean;
  /** Toifa: xodim / talaba / mehmon */
  visitorTypeEnabled: boolean;
  /** Murojaat turi: offline / telefon / telegram */
  channelEnabled: boolean;
  /** Rahbarlar choraklik hisobotni (AI, token sarflaydi) tayyorlay oladimi. Superadmin har doim tayyorlay oladi */
  reportGenerationEnabled: boolean;
  /** Har kuni 18:00 da bo'lim boshliqlariga Telegram orqali kunlik hisobot */
  dailyReportEnabled: boolean;
  /** 18:00 da ish yozmaganlarga eslatma, 00:00 gacha yozmasa -1 jarima balli */
  penaltiesEnabled: boolean;
  /** Oddiy eslatma matni (18:00 avtomatik va qo'lda). {ism} — xodim ismi, {ball} — jami jarima ballari */
  reminderText: string;
  /** Qattiq eslatma matni (qo'lda yuboriladi) */
  strictReminderText: string;
}

export const DEFAULT_REMINDER_TEXT = [
  'Hurmatli {ism}, bugun qilgan ishlaringizni yozib qo‘ying.',
  'Pastdagi «✍️ Ish yozish» tugmasini bosing yoki ishni shu botga oddiy xabar qilib yuboring.',
  '',
  '00:00 gacha ish yozilmasa, −1 jarima balli beriladi.',
].join('\n');

export const DEFAULT_STRICT_REMINDER_TEXT = [
  'Hurmatli {ism}! Ish yozish muntazam esdan chiqmoqda. Hozirgi jarima ballaringiz: {ball}.',
  '',
  'Bugun 00:00 gacha ish yozilmasa, yana −1 jarima balli beriladi. Jarima ballari ko‘payib borsa, rahbariyat nomiga tushuntirish xati yozishingizga to‘g‘ri keladi.',
  '',
  'Iltimos, qilgan ishlaringizni har kuni o‘z vaqtida yozib boring.',
].join('\n');

export const DEFAULT_SETTINGS: Settings = {
  appealStatusEnabled: true,
  visitorTypeEnabled: true,
  channelEnabled: true,
  reportGenerationEnabled: true,
  dailyReportEnabled: true,
  penaltiesEnabled: true,
  reminderText: DEFAULT_REMINDER_TEXT,
  strictReminderText: DEFAULT_STRICT_REMINDER_TEXT,
};
