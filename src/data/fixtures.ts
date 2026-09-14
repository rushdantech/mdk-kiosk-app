import type { Bill, Citizen } from '../types'

export const DEMO_CITIZEN: Citizen = {
  name: 'Siti Aminah binti Osman',
  ic: '650514086361',
  shortName: 'Puan Siti',
}

export const DEMO_BILLS: Bill[] = [
  {
    id: 'asm-7708',
    kind: 'assessment',
    accountNo: 'T-070017708-08',
    titleMs: 'Cukai taksiran',
    titleEn: 'Assessment tax',
    detailMs:
      'C-2-8 Waterfront Villa, WFV Blok C, Bukit Merah Laketown, 34400 Spg. Ampat Semanggol',
    detailEn:
      'C-2-8 Waterfront Villa, WFV Block C, Bukit Merah Laketown, 34400 Spg. Ampat Semanggol',
    amount: 6412.88,
    dateMs: '1 Jul – 31 Dis 2026',
    dateEn: '1 Jul – 31 Dec 2026',
  },
  {
    id: 'cmp-tlk',
    kind: 'compound',
    noticeNo: 'K58260902003',
    plate: 'SB4811K',
    titleMs: 'Kompaun trafik',
    titleEn: 'Traffic compound',
    detailMs: 'Tidak mempamerkan kupon yang sah — kereta',
    detailEn: 'Did not display a valid parking coupon — car',
    amount: 10,
    originalAmount: 30,
    dateMs: '2 Sep 2026',
    dateEn: '2 Sep 2026',
  },
  {
    id: 'cmp-lesen',
    kind: 'compound',
    noticeNo: 'K02M250716001',
    titleMs: 'Kompaun bukan trafik',
    titleEn: 'Non-traffic compound',
    detailMs: 'Kesalahan menjalankan perniagaan tanpa lesen',
    detailEn: 'Operating a business without a licence',
    amount: 250,
    originalAmount: 750,
    dateMs: '1 Jul 2025',
    dateEn: '1 Jul 2025',
  },
]

export const SCAN_TARGETS: Record<string, string> = {
  'T-070017708-08': 'asm-7708',
  K58260902003: 'cmp-tlk',
  K02M250716001: 'cmp-lesen',
}

export function normalizeKey(value: string): string {
  return value.replace(/[\s._]/g, '').toUpperCase()
}

export function findBills(query: {
  kind: 'assessment' | 'compound'
  accountNo?: string
  idNo?: string
  noticeNo?: string
  plate?: string
}): Bill[] {
  const account = normalizeKey(query.accountNo ?? '')
  const idNo = normalizeKey(query.idNo ?? '')
  const notice = normalizeKey(query.noticeNo ?? '')
  const plate = normalizeKey(query.plate ?? '')

  const byId = idNo === '650514086361' || idNo === 'ID0117708'
  const byAccount = account === 'T-070017708-08' || account === 'T07001770808'
  const byNotice =
    notice === 'K58260902003' || notice === 'K02M250716001'
  const byPlate = plate === 'SB4811K'

  if (query.kind === 'assessment') {
    if (byAccount) {
      return DEMO_BILLS.filter((bill) => bill.id === 'asm-7708')
    }
    if (byId) {
      return DEMO_BILLS.filter((bill) => bill.kind === 'assessment')
    }
    return []
  }

  if (byNotice) {
    const id = notice === 'K58260902003' ? 'cmp-tlk' : 'cmp-lesen'
    return DEMO_BILLS.filter((bill) => bill.id === id)
  }
  if (byPlate) {
    return DEMO_BILLS.filter((bill) => bill.id === 'cmp-tlk')
  }
  if (idNo === '650514086361' || idNo === '840306085986') {
    return DEMO_BILLS.filter((bill) => bill.kind === 'compound')
  }
  return []
}

export function money(value: number): string {
  return value.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function maskIc(ic: string): string {
  return `${ic.slice(0, 6)}-••-••••`
}

export function formatIc(ic: string): string {
  const digits = ic.replace(/\D/g, '')
  if (digits.length < 12) {
    return ic
  }
  return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 12)}`
}
