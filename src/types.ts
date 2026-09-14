export type Lang = 'ms' | 'en'
export type Channel = 'mykad' | 'voice' | 'scan' | 'keyin'
export type BillKind = 'assessment' | 'compound'
export type PayMethod = 'duitnow' | 'card'

export interface Citizen {
  name: string
  ic: string
  shortName: string
}

export interface Bill {
  id: string
  kind: BillKind
  accountNo?: string
  noticeNo?: string
  plate?: string
  titleMs: string
  titleEn: string
  detailMs: string
  detailEn: string
  amount: number
  originalAmount?: number
  dateMs: string
  dateEn: string
}

export interface ChatLine {
  from: 'bot' | 'user'
  ms: string
  en: string
}
