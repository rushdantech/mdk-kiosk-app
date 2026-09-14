<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PaymentPanel from '../components/PaymentPanel.vue'
import { money } from '../data/fixtures'
import { useT } from '../i18n'
import { finishPayment, loadCitizenBills, selectedTotal, session } from '../store/session'
import type { PayMethod } from '../types'

const router = useRouter()
const route = useRoute()
const tx = useT()
const pending = ref<PayMethod | null>(null)
const method = ref<PayMethod | null>(null)

function askConfirm(next: PayMethod): void {
  pending.value = next
  method.value = null
}

function confirmPending(): void {
  if (!pending.value || session.selected.size === 0) {
    return
  }
  method.value = pending.value
}

function cancelPending(): void {
  pending.value = null
  method.value = null
}

onMounted(() => {
  if (!session.citizen || session.bills.length === 0) {
    loadCitizenBills(session.channel)
  }
})

watch(
  () => route.query.method,
  (requested) => {
    if (requested === 'duitnow' || requested === 'card') {
      askConfirm(requested)
    }
  },
  { immediate: true },
)

function complete(next: PayMethod): void {
  finishPayment(next)
  void router.push('/done')
}
</script>

<template>
  <section class="panel">
    <h1>{{ method ? (method === 'card' ? tx('card') : tx('duitnow')) : tx('payTitle') }}</h1>
    <p class="lead">
      {{
        method
          ? method === 'card'
            ? tx('cardWait')
            : tx('scanQr')
          : pending
            ? tx('confirmPayTitle')
            : tx('payLead')
      }}
      · {{ tx('total') }} RM {{ money(selectedTotal) }}
    </p>

    <div v-if="!pending && !method" class="pay-grid">
      <button type="button" class="pay-card" @click="askConfirm('duitnow')">
        <h2>{{ tx('duitnow') }}</h2>
        <p class="lead">{{ tx('duitnowBody') }}</p>
      </button>
      <button type="button" class="pay-card" @click="askConfirm('card')">
        <h2>{{ tx('card') }}</h2>
        <p class="lead">{{ tx('cardBody') }}</p>
      </button>
    </div>

    <div v-else-if="pending && !method" class="confirm-pay">
      <h2>{{ pending === 'card' ? tx('card') : tx('duitnow') }}</h2>
      <p class="lead">
        {{ pending === 'card' ? tx('confirmCard') : tx('confirmDuitnow') }}
      </p>
      <p class="amount">RM {{ money(selectedTotal) }}</p>
      <div class="actions">
        <button type="button" class="ghost" @click="cancelPending">{{ tx('confirmNo') }}</button>
        <button
          type="button"
          class="solid"
          :disabled="session.selected.size === 0"
          @click="confirmPending"
        >
          {{ tx('confirmYes') }}
        </button>
      </div>
    </div>

    <PaymentPanel v-else-if="method" :method="method" @back="cancelPending" @complete="complete" />
  </section>
</template>
