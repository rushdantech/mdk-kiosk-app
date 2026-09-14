import { computed, reactive } from 'vue'
import { DEMO_BILLS, DEMO_CITIZEN } from '../data/fixtures'
import type { Bill, Channel, Citizen, Lang, PayMethod } from '../types'

export const session = reactive({
  lang: 'ms' as Lang,
  channel: 'mykad' as Channel,
  citizen: null as Citizen | null,
  bills: [] as Bill[],
  selected: new Set<string>(),
  payMethod: null as PayMethod | null,
  receiptNo: '',
})

export function resetSession(): void {
  session.channel = 'mykad'
  session.citizen = null
  session.bills = []
  session.selected = new Set()
  session.payMethod = null
  session.receiptNo = ''
}

export type BillScope = 'all' | 'assessment' | 'compound'

export function loadCitizenBills(channel: Channel, scope: BillScope = 'all'): void {
  session.channel = channel
  session.citizen = { ...DEMO_CITIZEN }
  const bills = DEMO_BILLS.filter((bill) => scope === 'all' || bill.kind === scope)
  session.bills = bills.map((bill) => ({ ...bill }))
  session.selected = new Set(bills.map((bill) => bill.id))
  session.payMethod = null
  session.receiptNo = ''
}

export function revealCitizenBills(channel: Channel, scope: BillScope = 'all'): void {
  const hadAssessment = session.bills.some((bill) => bill.kind === 'assessment')
  const hadCompound = session.bills.some((bill) => bill.kind === 'compound')
  const mergeAll =
    scope === 'all' ||
    (scope === 'compound' && hadAssessment) ||
    (scope === 'assessment' && hadCompound)
  loadCitizenBills(channel, mergeAll ? 'all' : scope)
}

export function loadBills(bills: Bill[], channel: Channel): void {
  session.channel = channel
  session.citizen = { ...DEMO_CITIZEN }
  session.bills = bills.map((bill) => ({ ...bill }))
  session.selected = new Set(bills.map((bill) => bill.id))
  session.payMethod = null
  session.receiptNo = ''
}

export function loadSingleBill(billId: string, channel: Channel): void {
  const bill = DEMO_BILLS.find((item) => item.id === billId)
  if (!bill) {
    return
  }
  session.channel = channel
  session.citizen = { ...DEMO_CITIZEN }
  session.bills = [{ ...bill }]
  session.selected = new Set([bill.id])
  session.payMethod = null
  session.receiptNo = ''
}

export function toggleBill(id: string): void {
  const next = new Set(session.selected)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  session.selected = next
}

export function selectAllBills(): void {
  session.selected = new Set(session.bills.map((bill) => bill.id))
}

export function clearBills(): void {
  session.selected = new Set()
}

export const selectedBills = computed(() =>
  session.bills.filter((bill) => session.selected.has(bill.id)),
)

export const selectedTotal = computed(() =>
  selectedBills.value.reduce((sum, bill) => sum + bill.amount, 0),
)

export function finishPayment(method: PayMethod): void {
  session.payMethod = method
  const stamp = Date.now().toString().slice(-6)
  session.receiptNo = `MDK-PBT-${stamp}`
}
