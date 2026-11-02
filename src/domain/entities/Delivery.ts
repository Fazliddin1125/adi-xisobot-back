export const DELIVERY_KINDS = ['eslatma', 'qolda_eslatma', 'jarima', 'kunlik_hisobot'] as const;
export type DeliveryKind = (typeof DELIVERY_KINDS)[number];

/** Bitta odamga yuborish natijasi */
export interface DeliveryResult {
  userId: string;
  fullName: string;
  ok: boolean;
  /** Yetib bormagan bo'lsa — sababi odamcha tilda */
  reason?: string;
}

/** Bot bir martada yuborgan xabarlar to'plami (masalan 18:00 eslatmasi) — admin kim olganini ko'radi */
export interface DeliveryLog {
  id: string;
  kind: DeliveryKind;
  title: string;
  /** Kim yubordi (qo'lda eslatma bo'lsa) */
  byName?: string;
  results: DeliveryResult[];
  createdAt: Date;
}
