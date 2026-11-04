import { createHmac, timingSafeEqual } from 'node:crypto';
import type { TelegramAuthVerifier } from '../../application/ports/TelegramAuthVerifier.js';

/** initData qancha vaqt amal qiladi (WebApp ochilgandan keyin) */
const MAX_AGE_SECONDS = 24 * 3600;

/**
 * Telegram hujjatidagi algoritm: secret = HMAC_SHA256("WebAppData", botToken),
 * hash = HMAC_SHA256(secret, "key=value\n..." — hash'dan tashqari, kalit bo'yicha saralangan).
 * Bot tokenini bilmagan odam initData'ni soxtalashtira olmaydi.
 */
export class TelegramInitDataVerifier implements TelegramAuthVerifier {
  private readonly secret: Buffer;

  constructor(botToken: string) {
    this.secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  }

  verify(initData: string): string | null {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash || !/^[a-f0-9]{64}$/.test(hash)) return null;
    params.delete('hash');
    const dataCheck = [...params.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const expected = createHmac('sha256', this.secret).update(dataCheck).digest();
    if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) return null;

    const authDate = Number(params.get('auth_date'));
    if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) return null;
    try {
      const id = (JSON.parse(params.get('user') ?? '{}') as { id?: number }).id;
      return id ? String(id) : null;
    } catch {
      return null;
    }
  }
}
