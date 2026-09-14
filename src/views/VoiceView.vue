<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import OnScreenKeyboard from '../components/OnScreenKeyboard.vue'
import PaymentPanel from '../components/PaymentPanel.vue'
import { money, normalizeKey } from '../data/fixtures'
import { billDate, billDetail, billTitle, useT } from '../i18n'
import {
  finishPayment,
  loadCitizenBills,
  selectedTotal,
  session,
  toggleBill,
} from '../store/session'
import type { ChatLine, PayMethod } from '../types'
import {
  createVoiceRuntime,
  lineText,
  type AgentPhase,
  type CaptionFrom,
} from '../voice/agent'
import { inferConfirm, type PayChoice } from '../voice/intent'

type VoicePhase = 'identify' | 'loading' | 'session'
type IdentifyMode = 'choose' | 'insert' | 'keyin'
type PayStage = 'bills' | 'confirm' | 'duitnow' | 'card'

const DEMO_IC = '650514086361'

const router = useRouter()
const tx = useT()
const voicePhase = ref<VoicePhase>('identify')
const identifyMode = ref<IdentifyMode>('choose')
const icInput = ref('')
const icError = ref(false)
const queryStep = ref(0)
const phase = ref<AgentPhase>('connecting')
const interim = ref('')
const liveFrom = ref<CaptionFrom>('bot')
const muted = ref(false)
const captions = ref<ChatLine[]>([])
const error = ref('')
const talkList = ref<HTMLOListElement | null>(null)
const payStage = ref<PayStage>('bills')
const pendingMethod = ref<PayMethod | null>(null)
const agentReady = ref(false)
const agentStarted = ref(false)

const paying = computed(() => payStage.value === 'duitnow' || payStage.value === 'card')
const agentBooting = computed(
  () => voicePhase.value === 'session' && !agentReady.value && !error.value,
)

let queryTick = 0
let queryDone = 0
let kadAuto = 0

const querySteps = computed(() => [
  tx.value('kadQueryChip'),
  tx.value('kadQueryIc'),
  tx.value('kadQueryTax'),
  tx.value('kadQuerySummons'),
])

const runtime = createVoiceRuntime({
  onPhase(next) {
    phase.value = next
    if (next === 'speaking' || next === 'listening') {
      agentReady.value = true
    }
  },
  onCaption(line, live, from) {
    if (line?.from === 'bot') {
      agentReady.value = true
    }
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
  onOfferRecords() {
    /* identity handled before the agent starts */
  },
  canConfirmRecords() {
    return false
  },
  onConfirmRecords() {
    /* identity handled before the agent starts */
  },
  isRecordsReady() {
    return voicePhase.value === 'session'
  },
  onOfferPayment(method: PayChoice) {
    offerPayment(method)
  },
  canConfirmPayment() {
    return paymentConfirmReady()
  },
  onConfirmPayment() {
    confirmPay()
  },
  onCancelPending() {
    cancelPending()
  },
  onError(message) {
    agentReady.value = true
    error.value = message || tx.value('voiceError')
  },
})

function clearTimers(): void {
  window.clearInterval(queryTick)
  window.clearTimeout(queryDone)
  window.clearTimeout(kadAuto)
}

function beginLoading(): void {
  icError.value = false
  voicePhase.value = 'loading'
  queryStep.value = 0
  queryTick = window.setInterval(() => {
    queryStep.value = (queryStep.value + 1) % querySteps.value.length
  }, 700)
  queryDone = window.setTimeout(() => {
    window.clearInterval(queryTick)
    startSession()
  }, 4200)
}

function startSession(): void {
  loadCitizenBills('voice', 'all')
  voicePhase.value = 'session'
  agentReady.value = false
  if (!agentStarted.value) {
    agentStarted.value = true
    void runtime.start()
  }
}

function openInsert(): void {
  identifyMode.value = 'insert'
  window.clearTimeout(kadAuto)
  kadAuto = window.setTimeout(beginLoading, 3200)
}

function openKeyIn(): void {
  identifyMode.value = 'keyin'
  icInput.value = ''
  icError.value = false
}

function backToChoose(): void {
  window.clearTimeout(kadAuto)
  identifyMode.value = 'choose'
  icInput.value = ''
  icError.value = false
}

function simulateKad(): void {
  window.clearTimeout(kadAuto)
  beginLoading()
}

function typeIc(value: string): void {
  if (!/^\d$/.test(value)) {
    return
  }
  icError.value = false
  if (icInput.value.length >= 12) {
    return
  }
  icInput.value += value
}

function backspaceIc(): void {
  icError.value = false
  icInput.value = icInput.value.slice(0, -1)
}

function clearIc(): void {
  icError.value = false
  icInput.value = ''
}

function verifyIc(): void {
  const key = normalizeKey(icInput.value)
  if (key === DEMO_IC) {
    beginLoading()
    return
  }
  icError.value = true
}

function offerPayment(method: PayChoice): void {
  if (voicePhase.value !== 'session') {
    return
  }
  if (method === 'choose') {
    if (!paying.value) {
      payStage.value = 'bills'
      pendingMethod.value = null
    }
    return
  }
  if (payStage.value === method) {
    return
  }
  pendingMethod.value = method
  payStage.value = 'confirm'
}

function paymentConfirmReady(): boolean {
  return (
    voicePhase.value === 'session' &&
    payStage.value === 'confirm' &&
    pendingMethod.value !== null &&
    session.selected.size > 0
  )
}

function confirmPay(): void {
  if (!paymentConfirmReady() || !pendingMethod.value) {
    return
  }
  payStage.value = pendingMethod.value
}

function cancelPay(): void {
  pendingMethod.value = null
  payStage.value = 'bills'
}

function cancelPending(): void {
  if (payStage.value === 'confirm' || paying.value) {
    cancelPay()
  }
}

function completePay(method: PayMethod): void {
  runtime.stop()
  finishPayment(method)
  void router.push('/done')
}

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

function who(from: CaptionFrom): string {
  return from === 'user' ? tx.value('you') : tx.value('assistant')
}

watch(captions, () => {
  if (voicePhase.value !== 'session') {
    return
  }
  const lastUser = [...captions.value].reverse().find((line) => line.from === 'user')
  if (!lastUser) {
    return
  }
  const answer = inferConfirm(lineText(lastUser))
  if (answer === false) {
    cancelPending()
    return
  }
  if (answer === true && paymentConfirmReady()) {
    confirmPay()
  }
  void nextTick(() => {
    const list = talkList.value
    if (list) {
      list.scrollTop = list.scrollHeight
    }
  })
})

watch(interim, () => {
  void nextTick(() => {
    const list = talkList.value
    if (list) {
      list.scrollTop = list.scrollHeight
    }
  })
})

const confirmCopy = computed(() =>
  pendingMethod.value === 'card' ? tx.value('confirmCard') : tx.value('confirmDuitnow'),
)

onUnmounted(() => {
  runtime.stop()
  clearTimers()
})
</script>

<template>
  <section v-if="voicePhase === 'identify'" class="panel">
    <h1>{{ tx('voiceIdentifyTitle') }}</h1>
    <p class="lead">{{ tx('voiceIdentifyLead') }}</p>

    <div v-if="identifyMode === 'choose'" class="doors voice-id-doors">
      <button type="button" class="door" @click="openInsert">
        <div class="door-art" style="background: linear-gradient(145deg, #1f4d34, #79c59a)"></div>
        <h2>{{ tx('voiceInsertMykad') }}</h2>
        <p>{{ tx('voiceInsertMykadBody') }}</p>
        <span class="go">{{ tx('continue') }} →</span>
      </button>
      <button type="button" class="door" @click="openKeyIn">
        <div class="door-art" style="background: linear-gradient(145deg, #5a4718, #d7b85d)"></div>
        <h2>{{ tx('voiceKeyInIc') }}</h2>
        <p>{{ tx('voiceKeyInIcBody') }}</p>
        <span class="go">{{ tx('continue') }} →</span>
      </button>
    </div>

    <div v-else-if="identifyMode === 'insert'" class="slot-card voice-id-panel">
      <p><span class="pulse"></span>{{ tx('kadHint') }}</p>
      <div class="reader" aria-hidden="true">
        <div class="reader-card"></div>
        <div class="reader-slot"></div>
      </div>
      <div class="actions">
        <button type="button" class="ghost" @click="backToChoose">{{ tx('confirmNo') }}</button>
        <button type="button" class="solid" @click="simulateKad">{{ tx('kadSimulate') }}</button>
      </div>
    </div>

    <div v-else class="voice-id-panel">
      <div class="slot-card">
        <p class="ic">{{ tx('voiceKeyInIc') }}</p>
        <input
          class="field-display"
          :value="icInput"
          readonly
          :placeholder="tx('voiceIcPlaceholder')"
          aria-label="MyKad number"
        />
        <p v-if="icError" class="scan-unknown">{{ tx('voiceIcError') }}</p>
        <div class="actions">
          <button type="button" class="ghost" @click="backToChoose">{{ tx('confirmNo') }}</button>
          <button type="button" class="solid" :disabled="!icInput.trim()" @click="verifyIc">
            {{ tx('voiceIcVerify') }}
          </button>
        </div>
      </div>
      <OnScreenKeyboard @type="typeIc" @backspace="backspaceIc" @clear="clearIc" />
    </div>
  </section>

  <section v-else-if="voicePhase === 'loading'" class="panel" aria-live="polite" aria-busy="true">
    <h1>{{ tx('kadValid') }}</h1>
    <p class="lead">{{ tx('kadQuery') }}</p>
    <div class="slot-card voice-id-panel">
      <div class="query-stage">
        <div class="query-orb" aria-hidden="true">
          <span class="query-ring"></span>
          <span class="query-core"></span>
        </div>
        <p class="query-step">{{ querySteps[queryStep] }}</p>
        <div class="query-bar" aria-hidden="true"><span></span></div>
        <p class="ic">{{ tx('kadQueryHint') }}</p>
      </div>
    </div>
  </section>

  <section v-else class="voice-desk">
    <aside v-if="agentBooting" class="voice-talk agent-boot-inline">
      <div class="orb-wrap connecting" aria-hidden="true">
        <div class="orb-ring"></div>
        <div class="orb-ring delay"></div>
        <div class="orb">
          <span class="orb-core"></span>
        </div>
      </div>
      <h2>{{ tx('loadingAgent') }}</h2>
      <p class="lead">{{ tx('loadingAgentLead') }}</p>
    </aside>

    <aside v-else class="voice-talk">
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
          {{ tx('voiceSessionHint') }}
        </li>
      </ol>

      <div class="voice-actions">
        <button type="button" class="ghost" @click="toggleMute">
          {{ muted ? tx('unmute') : tx('mute') }}
        </button>
      </div>
    </aside>

    <div class="voice-bills">
      <template v-if="!paying">
        <p class="ic">{{ tx('billsHello') }} {{ session.citizen?.shortName }}</p>
        <h1>{{ tx('voiceBillsTitle') }}</h1>
        <p class="lead">{{ tx('billsLead') }}</p>

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

        <div v-if="payStage === 'confirm'" class="confirm-pay">
          <p class="ic">{{ tx('confirmPayTitle') }}</p>
          <h2>{{ pendingMethod === 'card' ? tx('card') : tx('duitnow') }}</h2>
          <p class="lead">{{ confirmCopy }}</p>
          <p class="amount">RM {{ money(selectedTotal) }}</p>
          <div class="actions">
            <button type="button" class="ghost" @click="cancelPay">{{ tx('confirmNo') }}</button>
            <button
              type="button"
              class="solid"
              :disabled="session.selected.size === 0"
              @click="confirmPay"
            >
              {{ tx('confirmYes') }}
            </button>
          </div>
        </div>

        <div v-else class="checkout voice-pay">
          <div>
            <p>{{ tx('total') }}</p>
            <p class="amount">RM {{ money(selectedTotal) }}</p>
          </div>
          <div class="voice-pay-methods">
            <button
              type="button"
              class="pay"
              :disabled="session.selected.size === 0"
              @click="offerPayment('duitnow')"
            >
              {{ tx('duitnow') }}
            </button>
            <button
              type="button"
              class="pay"
              :disabled="session.selected.size === 0"
              @click="offerPayment('card')"
            >
              {{ tx('card') }}
            </button>
          </div>
        </div>
      </template>

      <div v-else class="voice-pay-panel">
        <p class="ic">{{ tx('confirmPayTitle') }}</p>
        <PaymentPanel
          :method="payStage === 'card' ? 'card' : 'duitnow'"
          @back="cancelPay"
          @complete="completePay"
        />
      </div>
    </div>
  </section>
</template>
