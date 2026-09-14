<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PaymentPanel from '../components/PaymentPanel.vue'
import { money } from '../data/fixtures'
import { billDate, billDetail, billTitle, useT } from '../i18n'
import {
  finishPayment,
  revealCitizenBills,
  selectedTotal,
  session,
  toggleBill,
  type BillScope,
} from '../store/session'
import type { ChatLine, PayMethod } from '../types'
import {
  createVoiceRuntime,
  lineText,
  type AgentPhase,
  type CaptionFrom,
} from '../voice/agent'
import { inferBillScope, inferConfirm, inferPayChoice, type PayChoice } from '../voice/intent'

type PayStage = 'bills' | 'confirm' | 'duitnow' | 'card'
type DeskPhase = 'talk' | 'mykad' | 'query' | 'ready'

const router = useRouter()
const tx = useT()
const phase = ref<AgentPhase>('connecting')
const interim = ref('')
const liveFrom = ref<CaptionFrom>('bot')
const muted = ref(false)
const captions = ref<ChatLine[]>([])
const error = ref('')
const talkList = ref<HTMLOListElement | null>(null)
const deskPhase = ref<DeskPhase>('talk')
const pendingScope = ref<BillScope>('all')
const queryStep = ref(0)
const payStage = ref<PayStage>('bills')
const pendingMethod = ref<PayMethod | null>(null)

const agentReady = ref(false)
const booting = computed(() => !agentReady.value && !error.value)
const paying = computed(() => payStage.value === 'duitnow' || payStage.value === 'card')
const splitView = computed(() => deskPhase.value === 'ready')

let mykadAuto = 0
let queryTick = 0
let queryDone = 0

const querySteps = computed(() => [
  tx.value('kadQueryChip'),
  tx.value('kadQueryIc'),
  pendingScope.value === 'assessment'
    ? tx.value('kadQueryTax')
    : pendingScope.value === 'compound'
      ? tx.value('kadQuerySummons')
      : tx.value('voiceQueryBoth'),
])

function showBills(scope: BillScope = 'all'): void {
  revealCitizenBills('voice', scope)
}

function beginMykad(scope: BillScope = 'all'): void {
  if (deskPhase.value === 'ready') {
    showBills(scope)
    return
  }
  pendingScope.value = scope
  deskPhase.value = 'mykad'
  window.clearTimeout(mykadAuto)
}

function startMykadQuery(): void {
  if (deskPhase.value !== 'mykad') {
    return
  }
  window.clearTimeout(mykadAuto)
  deskPhase.value = 'query'
  queryStep.value = 0
  queryTick = window.setInterval(() => {
    queryStep.value = (queryStep.value + 1) % querySteps.value.length
  }, 700)
  queryDone = window.setTimeout(() => {
    window.clearInterval(queryTick)
    showBills(pendingScope.value)
    deskPhase.value = 'ready'
  }, 4200)
}

function clearMykadTimers(): void {
  window.clearTimeout(mykadAuto)
  window.clearInterval(queryTick)
  window.clearTimeout(queryDone)
}

function proposePay(method: PayChoice): void {
  if (deskPhase.value !== 'ready') {
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
    deskPhase.value === 'ready' &&
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

function completePay(method: PayMethod): void {
  runtime.stop()
  finishPayment(method)
  void router.push('/done')
}

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
  onRequestRecords(scope: BillScope) {
    beginMykad(scope)
  },
  isRecordsReady() {
    return deskPhase.value === 'ready'
  },
  onReadyToPay(method: PayChoice) {
    proposePay(method)
  },
  canConfirmPayment() {
    return paymentConfirmReady()
  },
  onConfirmPayment() {
    confirmPay()
  },
  onCancelPayment() {
    if (payStage.value === 'confirm' || paying.value) {
      cancelPay()
    }
  },
  onError(message) {
    agentReady.value = true
    error.value = message || tx.value('voiceError')
  },
})

const status = computed(() => {
  if (muted.value) {
    return tx.value('muted')
  }
  if (deskPhase.value === 'mykad') {
    return tx.value('voiceMykadStatus')
  }
  if (deskPhase.value === 'query') {
    return tx.value('kadQuery')
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

watch([captions, interim], () => {
  const lastUser = [...captions.value].reverse().find((line) => line.from === 'user')
  const spoken = `${interim.value} ${lastUser ? lineText(lastUser) : ''}`

  if (deskPhase.value === 'talk') {
    const scope = inferBillScope(spoken)
    if (scope) {
      beginMykad(scope)
    }
    return
  }

  if (deskPhase.value !== 'ready') {
    return
  }

  if (payStage.value === 'confirm') {
    const switchMethod = inferPayChoice(spoken)
    if (switchMethod === 'duitnow' || switchMethod === 'card') {
      proposePay(switchMethod)
    } else {
      const answer = inferConfirm(spoken)
      if (answer === true) {
        confirmPay()
      } else if (answer === false) {
        cancelPay()
      }
    }
  } else {
    const payMethod = inferPayChoice(spoken)
    if (payMethod === 'duitnow' || payMethod === 'card') {
      proposePay(payMethod)
    } else if (payMethod === 'choose') {
      payStage.value = 'bills'
      pendingMethod.value = null
    }
  }

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

const confirmCopy = computed(() =>
  pendingMethod.value === 'card' ? tx.value('confirmCard') : tx.value('confirmDuitnow'),
)

onMounted(() => {
  void runtime.start()
})

onUnmounted(() => {
  runtime.stop()
  clearMykadTimers()
})
</script>

<template>
  <section v-if="booting" class="agent-boot" aria-live="polite" aria-busy="true">
    <div class="orb-wrap connecting" aria-hidden="true">
      <div class="orb-ring"></div>
      <div class="orb-ring delay"></div>
      <div class="orb">
        <span class="orb-core"></span>
      </div>
    </div>
    <h1>{{ tx('loadingAgent') }}</h1>
    <p class="lead">{{ tx('loadingAgentLead') }}</p>
    <p class="voice-status">{{ tx('loadingAgentStatus') }}</p>
  </section>

  <section v-else class="voice-desk" :class="{ 'talk-only': !splitView }">
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

      <div v-if="deskPhase === 'talk'" class="voice-quick">
        <button type="button" class="ghost" @click="beginMykad('assessment')">
          {{ tx('assessment') }}
        </button>
        <button type="button" class="ghost" @click="beginMykad('compound')">
          {{ tx('summons') }}
        </button>
      </div>

      <div v-if="deskPhase === 'mykad'" class="voice-mykad slot-card">
        <h2>{{ tx('voiceMykadTitle') }}</h2>
        <p class="lead">{{ tx('voiceMykadLead') }}</p>
        <p><span class="pulse"></span>{{ tx('kadHint') }}</p>
        <div class="reader" aria-hidden="true">
          <div class="reader-card"></div>
          <div class="reader-slot"></div>
        </div>
        <div class="actions">
          <button type="button" class="solid" @click="startMykadQuery">
            {{ tx('kadSimulate') }}
          </button>
        </div>
      </div>

      <div v-else-if="deskPhase === 'query'" class="voice-mykad slot-card">
        <div class="query-stage" aria-live="polite" aria-busy="true">
          <div class="query-orb" aria-hidden="true">
            <span class="query-ring"></span>
            <span class="query-core"></span>
          </div>
          <p class="query-step">{{ querySteps[queryStep] }}</p>
          <div class="query-bar" aria-hidden="true"><span></span></div>
          <p class="ic">{{ tx('kadQueryHint') }}</p>
        </div>
      </div>

      <div class="voice-actions">
        <button type="button" class="ghost" @click="toggleMute">
          {{ muted ? tx('unmute') : tx('mute') }}
        </button>
      </div>
    </aside>

    <div v-if="splitView" class="voice-bills">
      <template v-if="!paying">
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
              @click="proposePay('duitnow')"
            >
              {{ tx('duitnow') }}
            </button>
            <button
              type="button"
              class="pay"
              :disabled="session.selected.size === 0"
              @click="proposePay('card')"
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
