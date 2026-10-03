/** Parolni taxmin qilish (brute-force) urinishlarini cheklaydi */
export interface LoginThrottle {
  /** Bloklangan bo'lsa — necha daqiqadan keyin urinish mumkinligi, aks holda null */
  blockedFor(key: string, ip: string): number | null;
  recordFailure(key: string, ip: string): void;
  reset(key: string): void;
}
