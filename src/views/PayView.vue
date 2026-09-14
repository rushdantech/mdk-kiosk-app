<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { money } from '../data/fixtures'
import { useT } from '../i18n'
import { finishPayment, loadCitizenBills, selectedTotal, session } from '../store/session'
import type { PayMethod } from '../types'

const router = useRouter()
const route = useRoute()
const tx = useT()
const method = ref<PayMethod | null>(null)
const seconds = ref(300)
let tick = 0

function choose(next: PayMethod): void {
  method.value = next
  if (next === 'duitnow') {
    window.clearInterval(tick)
    seconds.value = 300
    tick = window.setInterval(() => {
      seconds.value = Math.max(0, seconds.value - 1)
    }, 1000)
  }
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
      choose(requested)
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  window.clearInterval(tick)
})

const clock = computed(() => {
  const min = Math.floor(seconds.value / 60)
  const sec = `${seconds.value % 60}`.padStart(2, '0')
  return `${min}:${sec}`
})

function complete(next: PayMethod): void {
  window.clearInterval(tick)
  finishPayment(next)
  void router.push('/done')
}
</script>

<template>
  <section class="panel">
    <h1>{{ tx('payTitle') }}</h1>
    <p class="lead">{{ tx('payLead') }} · {{ tx('total') }} RM {{ money(selectedTotal) }}</p>

    <div v-if="!method" class="pay-grid">
      <button type="button" class="pay-card" @click="choose('duitnow')">
        <h2>{{ tx('duitnow') }}</h2>
        <p class="lead">{{ tx('duitnowBody') }}</p>
      </button>
      <button type="button" class="pay-card" @click="choose('card')">
        <h2>{{ tx('card') }}</h2>
        <p class="lead">{{ tx('cardBody') }}</p>
      </button>
    </div>

    <div v-else-if="method === 'duitnow'" class="qr-wrap">
      <svg class="qr" viewBox="0 0 29 29" role="img" :aria-label="tx('duitnow')">
        <rect width="29" height="29" fill="#fff" />
        <g fill="#111">
          <rect v-for="n in 40" :key="n" :x="(n * 3) % 27" :y="(n * 5) % 27" width="2" height="2" />
          <rect x="1" y="1" width="7" height="7" />
          <rect x="21" y="1" width="7" height="7" />
          <rect x="1" y="21" width="7" height="7" />
          <rect x="2" y="2" width="5" height="5" fill="#fff" />
          <rect x="22" y="2" width="5" height="5" fill="#fff" />
          <rect x="2" y="22" width="5" height="5" fill="#fff" />
          <rect x="3" y="3" width="3" height="3" />
          <rect x="23" y="3" width="3" height="3" />
          <rect x="3" y="23" width="3" height="3" />
        </g>
      </svg>
      <div>
        <h2>{{ tx('scanQr') }}</h2>
        <p class="lead">{{ tx('timeout') }} {{ clock }}</p>
        <p class="amount">RM {{ money(selectedTotal) }}</p>
        <div class="actions">
          <button type="button" class="ghost" @click="method = null">{{ tx('back') }}</button>
          <button type="button" class="solid" @click="complete('duitnow')">
            {{ tx('paidSimulate') }}
          </button>
        </div>
      </div>
    </div>

    <div v-else class="slot-card">
      <h2>{{ tx('card') }}</h2>
      <p class="lead">{{ tx('cardWait') }}</p>
      <div class="terminal">TERMINAL · WAIT</div>
      <div class="actions">
        <button type="button" class="ghost" @click="method = null">{{ tx('back') }}</button>
        <button type="button" class="solid" @click="complete('card')">
          {{ tx('cardSimulate') }}
        </button>
      </div>
    </div>
  </section>
</template>
