<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { money } from '../data/fixtures'
import { billDate, billDetail, billTitle, useT } from '../i18n'
import { selectedTotal, session, toggleBill } from '../store/session'
import type { ChatLine } from '../types'
import {
  createVoiceRuntime,
  lineText,
  type AgentPhase,
  type CaptionFrom,
} from '../voice/agent'
import type { PayChoice } from '../voice/intent'

const router = useRouter()
const tx = useT()
const phase = ref<AgentPhase>('connecting')
const interim = ref('')
const liveFrom = ref<CaptionFrom>('bot')
const muted = ref(false)
const readyToPay = ref(false)
const captions = ref<ChatLine[]>([])
const error = ref('')
const talkList = ref<HTMLOListElement | null>(null)
const revealed = ref(false)

const runtime = createVoiceRuntime({
  onPhase(next) {
    phase.value = next
  },
  onCaption(line, live, from) {
    if (from) {
      liveFrom.value = from
    }
    if (typeof live === 'string') {
      interim.value = live
    }
    if (line) {
      captions.value = [...captions.value, line].slice(-8)
    }
  },
  onShowBills() {
    revealed.value = true
  },
  onReadyToPay(method: PayChoice) {
    readyToPay.value = true
    revealed.value = true
    runtime.stop()
    if (method === 'duitnow' || method === 'card') {
      void router.push({ path: '/pay', query: { method } })
      return
    }
    void router.push('/pay')
  },
  onError(message) {
    error.value = message || tx.value('voiceError')
  },
})

const status = computed(() => {
  if (muted.value) {
    return tx.value('muted')
  }
  if (phase.value === 'connecting') {
    return tx.value('connecting')
  }
  if (phase.value === 'speaking') {
    return tx.value('speaking')
  }
  if (phase.value === 'thinking') {
    return tx.value('thinking')
  }
  return tx.value('listeningLive')
})

const assessments = computed(() => session.bills.filter((bill) => bill.kind === 'assessment'))
const summons = computed(() => session.bills.filter((bill) => bill.kind === 'compound'))

function toggleMute(): void {
  muted.value = !muted.value
  runtime.setMuted(muted.value)
}

function pay(): void {
  runtime.stop()
  void router.push('/pay')
}

function who(from: CaptionFrom): string {
  return from === 'user' ? tx.value('you') : tx.value('assistant')
}

watch([captions, interim], () => {
  void nextTick(() => {
    const list = talkList.value
    if (list) {
      list.scrollTop = list.scrollHeight
    }
  })
})

const listTitle = computed(() => {
  if (assessments.value.length && !summons.value.length) {
    return tx.value('assessment')
  }
  if (summons.value.length && !assessments.value.length) {
    return tx.value('summons')
  }
  return tx.value('voiceBillsTitle')
})

onMounted(() => {
  void runtime.start()
})

onUnmounted(() => {
  runtime.stop()
})
</script>

<template>
  <section class="voice-desk" :class="{ 'talk-only': !revealed }">
    <aside class="voice-talk">
      <p class="live-tag">{{ tx('live') }}</p>
      <p class="voice-status">{{ status }}</p>

      <div class="orb-wrap" :class="phase" aria-hidden="true">
        <div class="orb-ring"></div>
        <div class="orb-ring delay"></div>
        <div class="orb">
          <span class="orb-core"></span>
        </div>
      </div>

      <ol ref="talkList" class="talk-lines" aria-live="polite">
        <li v-if="error" class="talk-line bot">{{ error }}</li>
        <li
          v-for="(line, index) in captions"
          :key="`${line.from}-${index}-${lineText(line)}`"
          class="talk-line"
          :class="line.from"
        >
          <span class="who">{{ who(line.from) }}</span>
          <span>{{ lineText(line) }}</span>
        </li>
        <li v-if="interim.trim()" class="talk-line live" :class="liveFrom">
          <span class="who">{{ who(liveFrom) }}</span>
          <span>{{ interim }}</span>
        </li>
        <li v-if="!error && !captions.length && !interim.trim()" class="talk-line hint">
          {{ tx('voiceHint') }}
        </li>
      </ol>

      <div class="voice-actions">
        <button type="button" class="ghost" @click="toggleMute">
          {{ muted ? tx('unmute') : tx('mute') }}
        </button>
      </div>
    </aside>

    <div v-if="revealed" class="voice-bills">
      <p class="ic">{{ tx('billsHello') }} {{ session.citizen?.shortName }}</p>
      <h1>{{ listTitle }}</h1>

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

        <p v-if="summons.length" class="ic">{{ tx('summons') }}</p>
        <button
          v-for="bill in summons"
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
        <button
          type="button"
          class="pay"
          :disabled="session.selected.size === 0 && !readyToPay"
          @click="pay"
        >
          {{ tx('payNow') }} RM {{ money(selectedTotal) }}
        </button>
      </div>
    </div>
  </section>
</template>
