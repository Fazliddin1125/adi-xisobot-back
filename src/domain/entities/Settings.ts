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
}

export const DEFAULT_SETTINGS: Settings = {
  appealStatusEnabled: true,
  visitorTypeEnabled: true,
  channelEnabled: true,
  reportGenerationEnabled: true,
};
