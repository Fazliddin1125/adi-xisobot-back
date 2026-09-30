/** Murojaat formasidagi ixtiyoriy maydonlar — superadmin yoqadi/o'chiradi */
export interface Settings {
  /** "Hal qilindi / hal qilinmadi" */
  appealStatusEnabled: boolean;
  /** Toifa: xodim / talaba / mehmon */
  visitorTypeEnabled: boolean;
  /** Murojaat turi: offline / telefon / telegram */
  channelEnabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = { appealStatusEnabled: true, visitorTypeEnabled: true, channelEnabled: true };
