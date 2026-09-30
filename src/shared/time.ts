/**
 * Toshkent vaqti (UTC+5, yozgi vaqt yo'q) bo'yicha davr chegaralari.
 * Barcha chegaralar UTC Date sifatida qaytadi: [from, to).
 */
export const TIMEZONE = 'Asia/Tashkent';
const OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type Period = 'today' | 'week' | 'month';

export interface DateRange {
  from: Date;
  to: Date;
}

/** Toshkent bo'yicha "devor soati"ni UTC getterlar orqali o'qish uchun siljitilgan sana */
function shifted(date: Date): Date {
  return new Date(date.getTime() + OFFSET_MS);
}

export function startOfDay(date: Date): Date {
  const s = shifted(date);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()) - OFFSET_MS);
}

export function dayRange(date: Date): DateRange {
  const from = startOfDay(date);
  return { from, to: new Date(from.getTime() + DAY_MS) };
}

/** Hafta Dushanbadan boshlanadi */
export function weekRange(date: Date): DateRange {
  const from = startOfDay(date);
  const mondayIndex = (shifted(date).getUTCDay() + 6) % 7;
  const monday = new Date(from.getTime() - mondayIndex * DAY_MS);
  return { from: monday, to: new Date(monday.getTime() + 7 * DAY_MS) };
}

export function monthRange(year: number, month: number): DateRange {
  return {
    from: new Date(Date.UTC(year, month - 1, 1) - OFFSET_MS),
    to: new Date(Date.UTC(year, month, 1) - OFFSET_MS),
  };
}

export function currentMonthKey(date = new Date()): string {
  const s = shifted(date);
  return `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** "YYYY-MM" → oy chegarasi */
export function parseMonth(key: string): DateRange {
  const [y, m] = key.split('-').map(Number);
  return monthRange(y, m);
}

export function resolveRange(period?: Period, month?: string, now = new Date()): DateRange {
  if (month) return parseMonth(month);
  switch (period) {
    case 'today':
      return dayRange(now);
    case 'week':
      return weekRange(now);
    default:
      return parseMonth(currentMonthKey(now));
  }
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** Toshkent bo'yicha "YYYY-MM-DD" */
export function dayKey(date: Date): string {
  return shifted(date).toISOString().slice(0, 10);
}

/** [from, to) oralig'idagi barcha kunlar kalitlari */
export function eachDayKey(range: DateRange): string[] {
  const keys: string[] = [];
  for (let t = range.from.getTime(); t < range.to.getTime(); t += DAY_MS) {
    keys.push(dayKey(new Date(t)));
  }
  return keys;
}

/** "28.09.2026 14:05" (Toshkent) */
export function formatDateTime(date: Date): string {
  const [day, time] = shifted(date).toISOString().slice(0, 16).split('T');
  return `${day.split('-').reverse().join('.')} ${time}`;
}
