<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { money } from '../data/fixtures'
import { useT } from '../i18n'
import { selectedTotal } from '../store/session'
import type { PayMethod } from '../types'

const props = defineProps<{ method: PayMethod }>()
const emit = defineEmits<{
  back: []
  complete: [method: PayMethod]
}>()

const tx = useT()
const seconds = ref(300)
let tick = 0

function startClock(): void {
  window.clearInterval(tick)
  seconds.value = 300
  if (props.method !== 'duitnow') {
    return
  }
  tick = window.setInterval(() => {
    seconds.value = Math.max(0, seconds.value - 1)
  }, 1000)
}

watch(
  () => props.method,
  () => {
    startClock()
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
</script>

<template>
  <div v-if="method === 'duitnow'" class="qr-wrap">
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
        <button type="button" class="ghost" @click="emit('back')">{{ tx('back') }}</button>
        <button type="button" class="solid" @click="emit('complete', 'duitnow')">
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
      <button type="button" class="ghost" @click="emit('back')">{{ tx('back') }}</button>
      <button type="button" class="solid" @click="emit('complete', 'card')">
        {{ tx('cardSimulate') }}
      </button>
    </div>
  </div>
</template>
