/** Telegram Bot API'ga minimal HTTP klient */
export class TelegramApi {
  constructor(
    private readonly token: string,
    private readonly baseUrl = 'https://api.telegram.org',
  ) {}

  async call<T>(method: string, body: Record<string, unknown>, timeoutMs = 15_000): Promise<T> {
    const res = await fetch(`${this.baseUrl}/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
    if (!data.ok) throw new Error(data.description ?? `Telegram API xatosi (${res.status})`);
    return data.result as T;
  }
}
