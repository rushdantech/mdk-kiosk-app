import type { BillScope } from '../store/session'
import type { PayMethod } from '../types'

export type PayChoice = PayMethod | 'choose'

function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function inferBillScope(text: string): BillScope | null {
  const spoken = normalizeSpeech(text)
  const tax = /cukai|taksiran|assessment|property tax|cukai pintu/.test(spoken)
  const summons =
    /saman|kompaun|summons|summon|compound|\bplat\b|\bplate\b|parking|notis trafik/.test(spoken)
  const everything =
    /semua|ada bil|bil apa|bil saya|tengok bil|lihat bil|semak bil|check bill|check my bill|yang tertunggak|what i owe|what do i owe|all bills|senarai|rekod|outstanding|tunjuk|papar|show bill|show list|list bill/.test(
      spoken,
    )

  if ((tax && summons) || everything) {
    return 'all'
  }
  if (tax) {
    return 'assessment'
  }
  if (summons) {
    return 'compound'
  }
  return null
}

export function inferPayChoice(text: string): PayChoice | null {
  const spoken = normalizeSpeech(text)
  if (
    /duit\s*n[ao]w|duitnow|do it now|doing now|duid now|kod qr|kod q r|\bqr\b|q r code|imbas qr|scan qr|ewallet|e wallet/.test(
      spoken,
    )
  ) {
    return 'duitnow'
  }
  if (
    /kad kredit|kad debit|credit card|debit card|\bcredit\b|\bdebit\b|terminal|\btap\b|\bcard\b|\bkredit\b|\bkad\b/.test(
      spoken,
    )
  ) {
    return 'card'
  }
  if (/bayar|pay now|nak bayar|mahu bayar|want to pay|pay with/.test(spoken)) {
    return 'choose'
  }
  return null
}

export function inferConfirm(text: string): boolean | null {
  const spoken = normalizeSpeech(text)
  if (!spoken) {
    return null
  }
  const short = spoken.split(' ').length <= 4
  if (
    /batal|cancel|kembali|\bback\b|jangan papar|tak mahu|tak nak|tak sah|\bno\b/.test(spoken)
  ) {
    return false
  }
  if (short && /\btidak\b|\bjangan\b|\bnanti\b/.test(spoken)) {
    return false
  }
  if (
    short &&
    /\bya\b|\byes\b|\bok\b|\bokay\b|\bsah\b|sahkan|confirm|setuju|teruskan|betul|agree|paparkan/.test(
      spoken,
    )
  ) {
    return true
  }
  return null
}
