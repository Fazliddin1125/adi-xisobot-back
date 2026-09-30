export const VISITOR_TYPES = ['xodim', 'talaba', 'mehmon'] as const;
export const CHANNELS = ['offline', 'telefon', 'telegram'] as const;
export const STATUSES = ['hal_qilindi', 'hal_qilinmadi'] as const;
export const ONLINE_CHANNELS: Channel[] = ['telefon', 'telegram'];

export type VisitorType = (typeof VISITOR_TYPES)[number];
export type Channel = (typeof CHANNELS)[number];
export type AppealStatus = (typeof STATUSES)[number];

export interface Appeal {
  id: string;
  /** Murojaat nomi: murojaatchi ismi yoki joy/muammo (masalan "3-bino, 2-qavat — Wi-Fi") */
  title: string;
  /** Toifa/kanal maydonlari sozlamada o'chirilgan paytda kiritilganlarda bo'lmaydi */
  visitorType?: VisitorType;
  channel?: Channel;
  /** Holat maydoni sozlamada o'chirilgan paytda kiritilganlarda bo'lmaydi */
  status?: AppealStatus;
  comment?: string;
  staffId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NewAppeal = Pick<Appeal, 'title' | 'visitorType' | 'channel' | 'status' | 'comment' | 'staffId'>;
export type AppealChanges = Partial<Pick<Appeal, 'title' | 'visitorType' | 'channel' | 'status' | 'comment'>>;

export function isOnline(channel?: Channel): boolean {
  return !!channel && ONLINE_CHANNELS.includes(channel);
}
