import type { AppealService } from '../../application/services/AppealService.js';
import type { Actor } from '../../application/Actor.js';
import type { Channel, VisitorType } from '../../domain/entities/Appeal.js';
import type { User } from '../../domain/entities/User.js';
import type { SettingsRepository } from '../../domain/repositories/SettingsRepository.js';
import type { UserRepository } from '../../domain/repositories/UserRepository.js';
import type { TelegramApi } from '../../infrastructure/telegram/TelegramApi.js';

interface Message {
  message_id: number;
  chat: { id: number; type: string };
  from?: { first_name?: string };
  text?: string;
}

interface Update {
  update_id: number;
  message?: Message;
  callback_query?: { id: string; data?: string; message?: Message };
}

type Button = { text: string; callback_data?: string; url?: string };

/** Botdan ish yozish: majburiy maydonlar (toifa, murojaat turi) tugmalar bilan so'raladi */
interface Draft {
  title: string;
  comment?: string;
  visitorType?: VisitorType;
  channel?: Channel;
  expires: number;
}

const DRAFT_TTL_MS = 15 * 60_000;
const VISITOR_BUTTONS: Button[] = [
  { text: 'Xodim', callback_data: 'vt:xodim' },
  { text: 'Talaba', callback_data: 'vt:talaba' },
  { text: 'Mehmon', callback_data: 'vt:mehmon' },
];
const CHANNEL_BUTTONS: Button[] = [
  { text: 'Offline', callback_data: 'ch:offline' },
  { text: 'Telefon', callback_data: 'ch:telefon' },
  { text: 'Telegram', callback_data: 'ch:telegram' },
];
const CANCEL: Button = { text: '❌ Bekor qilish', callback_data: 'cancel' };

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const actorOf = (u: User): Actor => ({ id: u.id, role: u.role, departmentId: u.departmentId });

/**
 * ATM yordamchi boti:
 *  - /start — salom; ulanmagan odamga Telegram ID raqamini beradi (superadminga yuborish uchun);
 *  - ulangan xodim oddiy xabar yuborsa — u "Ish" sifatida yoziladi (1-qator — nomi, qolgani — izoh);
 *  - /bugun — bugun yozilgan ishlar.
 */
export class TelegramIdBot {
  private offset = 0;
  private running = false;
  private readonly drafts = new Map<number, Draft>();

  constructor(
    private readonly api: TelegramApi,
    private readonly users: UserRepository,
    private readonly appeals: AppealService,
    private readonly settings: SettingsRepository,
    /** Jo'nalish kelishigida: "Fazliddinga (@fazliddin_bakhrom)" */
    private readonly supportContact: string,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.loop();
  }

  stop(): void {
    this.running = false;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        const updates = await this.api.call<Update[]>(
          'getUpdates',
          { offset: this.offset, timeout: 30, allowed_updates: ['message', 'callback_query'] },
          40_000,
        );
        for (const u of updates) {
          this.offset = u.update_id + 1;
          await this.handle(u).catch((err) => console.error('Telegram bot xatosi:', (err as Error).message));
        }
      } catch (err) {
        console.error('Telegram getUpdates xatosi:', (err as Error).message);
        await new Promise((r) => setTimeout(r, 5_000));
      }
    }
  }

  private async handle(u: Update): Promise<void> {
    if (u.callback_query) return this.onButton(u.callback_query);
    const msg = u.message;
    if (!msg || msg.chat.type !== 'private') return;
    const chatId = msg.chat.id;
    const user = await this.users.findByTelegramId(String(chatId));
    const text = msg.text?.trim() ?? '';

    if (!user || text.startsWith('/start') || text.startsWith('/yordam') || !text) return this.greet(chatId, user, msg.from?.first_name);
    if (text.startsWith('/bugun')) return this.today(chatId, user);
    if (text.startsWith('/')) return this.send(chatId, "Bunday buyruq yo'q. /bugun — bugungi ishlar, /yordam — qo'llanma.");

    const [first, ...rest] = text.split('\n');
    const title = first.trim().slice(0, 200);
    if (title.length < 2) return this.send(chatId, 'Ish nomi kamida 2 belgi bo‘lsin.');
    const comment = rest.join('\n').trim().slice(0, 1000) || undefined;
    this.drafts.set(chatId, { title, comment, expires: Date.now() + DRAFT_TTL_MS });
    await this.continueDraft(chatId, user);
  }

  /** Keyingi majburiy maydonni so'raydi yoki hammasi tayyor bo'lsa saqlaydi */
  private async continueDraft(chatId: number, user: User, editMessageId?: number): Promise<void> {
    const draft = this.drafts.get(chatId);
    if (!draft) return;
    const s = await this.settings.get();
    const head = `📝 <b>${escapeHtml(draft.title)}</b>`;
    const ask = (question: string, buttons: Button[]) =>
      this.sendOrEdit(chatId, `${head}\n\n${question}`, [buttons, [CANCEL]], editMessageId);

    if (s.visitorTypeEnabled && !draft.visitorType) return ask('Kim uchun? Toifani tanlang:', VISITOR_BUTTONS);
    if (s.channelEnabled && !draft.channel) return ask('Qanday murojaat bo‘ldi?', CHANNEL_BUTTONS);

    this.drafts.delete(chatId);
    const actor = actorOf(user);
    let appeal;
    try {
      appeal = await this.appeals.create(actor, {
        title: draft.title,
        comment: draft.comment,
        visitorType: draft.visitorType,
        channel: draft.channel,
      });
    } catch (err) {
      return this.sendOrEdit(chatId, `Ish yozilmadi: ${escapeHtml((err as Error).message)}`, [], editMessageId);
    }
    const count = (await this.appeals.list(actor, { period: 'today', staffId: user.id })).length;
    await this.sendOrEdit(
      chatId,
      `✅ <b>Ish yozildi</b>\n${escapeHtml(appeal.title)}${appeal.comment ? `\n<i>${escapeHtml(appeal.comment)}</i>` : ''}\n\nBugun jami: <b>${count} ta</b>`,
      [[{ text: '🗑 O‘chirish', callback_data: `del:${appeal.id}` }]],
      editMessageId,
    );
  }

  private async onButton(q: NonNullable<Update['callback_query']>): Promise<void> {
    await this.api.call('answerCallbackQuery', { callback_query_id: q.id }).catch(() => undefined);
    const chatId = q.message?.chat.id;
    const messageId = q.message?.message_id;
    if (!chatId || !messageId || !q.data) return;
    const user = await this.users.findByTelegramId(String(chatId));
    if (!user) return;
    const [kind, value] = q.data.split(':');

    if (kind === 'del') {
      try {
        await this.appeals.delete(actorOf(user), value);
        await this.sendOrEdit(chatId, '🗑 Ish o‘chirildi', [], messageId);
      } catch (err) {
        await this.send(chatId, `O‘chirib bo‘lmadi: ${escapeHtml((err as Error).message)}`);
      }
      return;
    }

    const draft = this.drafts.get(chatId);
    if (!draft || draft.expires < Date.now()) {
      this.drafts.delete(chatId);
      return this.sendOrEdit(chatId, 'Vaqt tugadi. Ishni qaytadan yozib yuboring.', [], messageId);
    }
    if (kind === 'cancel') {
      this.drafts.delete(chatId);
      return this.sendOrEdit(chatId, 'Bekor qilindi.', [], messageId);
    }
    if (kind === 'vt' && VISITOR_BUTTONS.some((b) => b.callback_data === q.data)) draft.visitorType = value as VisitorType;
    if (kind === 'ch' && CHANNEL_BUTTONS.some((b) => b.callback_data === q.data)) draft.channel = value as Channel;
    await this.continueDraft(chatId, user, messageId);
  }

  private async today(chatId: number, user: User): Promise<void> {
    const list = await this.appeals.list(actorOf(user), { period: 'today', staffId: user.id });
    if (!list.length) return this.send(chatId, 'Bugun hali ish yozmadingiz. Qilgan ishingizni shu yerga yozib yuboring.');
    const lines = list.map((a, i) => `${i + 1}. ${escapeHtml(a.title)}`);
    await this.send(chatId, [`📋 <b>Bugungi ishlaringiz: ${list.length} ta</b>`, '', ...lines].join('\n').slice(0, 4000));
  }

  /** Kontakt matnidan Telegram username (masalan "Fazliddinga (@fazliddin_bakhrom)" → "fazliddin_bakhrom") */
  private get supportUsername(): string | null {
    return /@([A-Za-z0-9_]{5,32})/.exec(this.supportContact)?.[1] ?? null;
  }

  private async greet(chatId: number, user: User | null, firstName?: string): Promise<void> {
    const name = escapeHtml(user?.fullName ?? firstName ?? '');
    const username = this.supportUsername;
    const intro = "Bu — ADU ATM bo'limining yordamchi boti. Bu yerda sizga berilgan topshiriqlar haqida xabar olasiz va qilgan ishlaringizni yozasiz.";

    const text = user
      ? [
          `Assalomu alaykum, <b>${name}</b>! 👋`,
          '',
          intro,
          '',
          '✍️ <b>Ish yozish:</b> qilgan ishingizni shu yerga oddiy xabar qilib yuboring.',
          '<i>1-qator — ish nomi, keyingi qatorlar — izoh (ixtiyoriy).</i>',
          'Masalan: <code>3-bino, 2-qavat — Wi-Fi tiklandi</code>',
          '',
          '📋 /bugun — bugun yozgan ishlaringiz',
          '⏰ Soat 18:00 gacha ish yozilmasa eslataman. 00:00 gacha yozilmasa — -1 jarima balli.',
          '',
          `🆔 Telegram ID raqamingiz: <code>${chatId}</code>`,
          username ? `💬 Savollar bo'lsa: @${username}` : null,
        ]
      : [
          `Assalomu alaykum${name ? `, <b>${name}</b>` : ''}! 👋`,
          '',
          intro,
          '',
          `🆔 Sizning Telegram ID raqamingiz: <code>${chatId}</code>`,
          '<i>(raqam ustiga bossangiz, nusxa olinadi)</i>',
          '',
          username
            ? `👤 Bot ishlay boshlashi uchun shu raqamni ${escapeHtml(this.supportContact.replace(/\s*\(@\w+\)/, ''))} yuboring: @${username}`
            : `👤 Bot ishlay boshlashi uchun shu raqamni ${escapeHtml(this.supportContact)} yuboring.`,
        ];

    // Ulanmagan odamga — kontakt bilan chatni bir bosishda ochadigan tugma
    const buttons = username && !user ? [[{ text: `✍️ @${username} ga yozish`, url: `https://t.me/${username}` }]] : [];
    await this.sendOrEdit(chatId, text.filter((l) => l !== null).join('\n'), buttons);
  }

  private send(chatId: number, html: string): Promise<void> {
    return this.sendOrEdit(chatId, html, []);
  }

  /** editMessageId berilsa — o'sha xabarni yangilaydi (tugmalar bosilganda chat to'lib ketmasligi uchun) */
  private async sendOrEdit(chatId: number, html: string, buttons: Button[][], editMessageId?: number): Promise<void> {
    const body = {
      chat_id: chatId,
      text: html,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons },
    };
    await this.api
      .call(editMessageId ? 'editMessageText' : 'sendMessage', editMessageId ? { ...body, message_id: editMessageId } : body)
      .catch((err) => console.error('Telegram javob xatosi:', (err as Error).message));
  }
}
