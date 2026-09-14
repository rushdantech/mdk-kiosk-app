<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { formatIc, money } from '../data/fixtures'
import { billDate, billDetail, billTitle, useT } from '../i18n'
import {
  clearBills,
  loadCitizenBills,
  selectAllBills,
  selectedTotal,
  session,
  toggleBill,
} from '../store/session'

const router = useRouter()
const tx = useT()

onMounted(() => {
  if (!session.citizen) {
    loadCitizenBills(session.channel)
  }
})

const assessments = computed(() => session.bills.filter((bill) => bill.kind === 'assessment'))
const compounds = computed(() => session.bills.filter((bill) => bill.kind === 'compound'))

function goPay(): void {
  if (session.selected.size === 0) {
    return
  }
  void router.push('/pay')
}
</script>

<template>
  <section class="panel">
    <div class="bill-head">
      <div>
        <p class="ic">{{ tx('billsHello') }}</p>
        <h1>{{ session.citizen?.name }}</h1>
        <p v-if="session.citizen" class="id-line">
          {{ tx('mykadNo') }} {{ formatIc(session.citizen.ic) }}
        </p>
        <p class="lead">{{ tx('billsLead') }}</p>
      </div>
      <div class="actions">
        <button type="button" class="ghost" @click="selectAllBills">{{ tx('selectAll') }}</button>
        <button type="button" class="ghost" @click="clearBills">{{ tx('clearAll') }}</button>
      </div>
    </div>

    <div class="groups">
      <p v-if="assessments.length" class="ic">{{ tx('assessment') }}</p>
      <button
        v-for="bill in assessments"
        :key="bill.id"
        type="button"
        class="bill-card"
        :class="{ on: session.selected.has(bill.id) }"
        @click="toggleBill(bill.id)"
      >
        <span class="check">{{ session.selected.has(bill.id) ? '✓' : '' }}</span>
        <span>
          <strong>{{ billTitle(bill) }}</strong>
          <p>{{ billDetail(bill) }}</p>
          <span class="tag">{{ tx('account') }} {{ bill.accountNo }} · {{ billDate(bill) }}</span>
        </span>
        <span class="amount">RM {{ money(bill.amount) }}</span>
      </button>

      <p v-if="compounds.length" class="ic">{{ tx('summons') }}</p>
      <button
        v-for="bill in compounds"
        :key="bill.id"
        type="button"
        class="bill-card"
        :class="{ on: session.selected.has(bill.id) }"
        @click="toggleBill(bill.id)"
      >
        <span class="check">{{ session.selected.has(bill.id) ? '✓' : '' }}</span>
        <span>
          <strong>{{ billTitle(bill) }}</strong>
          <p>{{ billDetail(bill) }}</p>
          <span class="tag">
            {{ tx('notice') }} {{ bill.noticeNo }}
            <template v-if="bill.plate"> · {{ tx('plate') }} {{ bill.plate }}</template>
          </span>
        </span>
        <span class="amount">
          <span v-if="bill.originalAmount" class="was">RM {{ money(bill.originalAmount) }}</span>
          RM {{ money(bill.amount) }}
          <span v-if="bill.originalAmount" class="tag">{{ tx('special') }}</span>
        </span>
      </button>
    </div>

    <div class="checkout">
      <div>
        <p>{{ tx('total') }}</p>
        <p class="amount">RM {{ money(selectedTotal) }}</p>
      </div>
      <button type="button" class="pay" :disabled="session.selected.size === 0" @click="goPay">
        {{ session.selected.size === 0 ? tx('nothingDue') : `${tx('payNow')} RM ${money(selectedTotal)}` }}
      </button>
    </div>
  </section>
</template>
