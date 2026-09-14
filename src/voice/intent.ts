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
  const tax = /cukai|taksiran|assessment/.test(spoken)
  const summons = /saman|kompaun|summons|compound|\bplat\b|\bplate\b/.test(spoken)
  const everything =
    /semua|ada bil|bil apa|yang tertunggak|what i owe|what do i owe|all bills|senarai|rekod/.test(
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
