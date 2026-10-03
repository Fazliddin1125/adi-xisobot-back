import type { LoginThrottle } from '../../application/ports/LoginThrottle.js';

interface Counter {
  failures: number;
  windowStart: number;
  blockedUntil: number;
}

/**
 * Jarayon xotirasida ishlaydi (bitta API nusxasi uchun yetarli).
 * - bitta login + IP: KEY_LIMIT marta xato → BLOCK_MS blok
 * - bitta IP umumiy: IP_LIMIT marta xato → BLOCK_MS blok (turli loginlarni sinab chiqishga qarshi)
 */
export class MemoryLoginThrottle implements LoginThrottle {
  private readonly counters = new Map<string, Counter>();

  constructor(
    private readonly keyLimit = 5,
    private readonly ipLimit = 30,
    private readonly windowMs = 15 * 60 * 1000,
    private readonly blockMs = 15 * 60 * 1000,
  ) {
    // Eski yozuvlarni vaqti-vaqti bilan tozalaymiz
    setInterval(() => this.sweep(), this.windowMs).unref();
  }

  blockedFor(key: string, ip: string): number | null {
    const now = Date.now();
    const until = Math.max(this.counters.get(`k:${key}|${ip}`)?.blockedUntil ?? 0, this.counters.get(`ip:${ip}`)?.blockedUntil ?? 0);
    return until > now ? Math.ceil((until - now) / 60_000) : null;
  }

  recordFailure(key: string, ip: string): void {
    this.bump(`k:${key}|${ip}`, this.keyLimit);
    this.bump(`ip:${ip}`, this.ipLimit);
  }

  reset(key: string): void {
    for (const k of this.counters.keys()) if (k.startsWith(`k:${key}|`)) this.counters.delete(k);
  }

  private bump(id: string, limit: number) {
    const now = Date.now();
    let c = this.counters.get(id);
    if (!c || now - c.windowStart > this.windowMs) c = { failures: 0, windowStart: now, blockedUntil: 0 };
    c.failures++;
    if (c.failures >= limit) c.blockedUntil = now + this.blockMs;
    this.counters.set(id, c);
  }

  private sweep() {
    const now = Date.now();
    for (const [id, c] of this.counters) {
      if (c.blockedUntil < now && now - c.windowStart > this.windowMs) this.counters.delete(id);
    }
  }
}
