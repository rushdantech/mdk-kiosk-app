import type { BillScope } from '../store/session'
import type { PayMethod } from '../types'

export type PayChoice = PayMethod | 'choose'

export function inferBillScope(text: string): BillScope | null {
  const spoken = text.toLowerCase()
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
  const spoken = text.toLowerCase()
  if (/duit\s*now|duitnow|\bqr\b|kod qr/.test(spoken)) {
    return 'duitnow'
  }
  if (/\bkad\b|credit card|debit card|kad kredit|kad debit|\bcard\b|\bkredit\b/.test(spoken)) {
    return 'card'
  }
  if (/bayar|pay now|nak bayar|mahu bayar|want to pay/.test(spoken)) {
    return 'choose'
  }
  return null
}
