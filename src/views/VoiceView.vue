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
import type { PayChoice } from '../voice/intent'

type PayStage = 'bills' | 'confirm' | 'duitnow' | 'card'

const router = useRouter()
const tx = useT()
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
const billsVisible = ref(false)
const userHasSpoken = ref(false)
const booting = computed(() => !agentReady.value && !error.value)
const paying = computed(() => payStage.value === 'duitnow' || payStage.value === 'card')

function prepareVoiceSession(): void {
  session.citizen = null
  session.bills = []
  session.selected = new Set()
  billsVisible.value = false
  userHasSpoken.value = false
  payStage.value = 'bills'
  pendingMethod.value = null
}

function showBills(scope: BillScope = 'all'): void {
  revealCitizenBills('voice', scope)
  billsVisible.value = true
}

function proposePay(method: PayChoice): void {
  if (method === 'choose') {
    if (!paying.value) {
      if (!session.bills.length) {
        showBills('all')
      }
      payStage.value = 'bills'
      pendingMethod.value = null
    }
    return
  }
  if (!session.bills.length) {
    showBills('all')
  }
  if (payStage.value === method) {
    return
  }
  pendingMethod.value = method
  payStage.value = 'confirm'
}

function paymentConfirmReady(): boolean {
  return payStage.value === 'confirm' && pendingMethod.value !== null && session.selected.size > 0
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
  onUserSpoke() {
    userHasSpoken.value = true
  },
  canShowBills() {
    return userHasSpoken.value
  },
  onShowBills(scope: BillScope) {
    showBills(scope)
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

const hasBills = computed(() => billsVisible.value)
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
  prepareVoiceSession()
  void runtime.start()
})

onUnmounted(() => {
  runtime.stop()
})
</script>

<template>
  <section class="voice-desk" :class="{ 'talk-only': !hasBills }">
    <aside class="voice-talk">
      <template v-if="booting">
        <div class="orb-wrap connecting" aria-hidden="true">
          <div class="orb-ring"></div>
          <div class="orb-ring delay"></div>
          <div class="orb">
            <span class="orb-core"></span>
          </div>
        </div>
        <h1 class="voice-boot-title">{{ tx('loadingAgent') }}</h1>
        <p class="lead">{{ tx('loadingAgentLead') }}</p>
        <p class="voice-status">{{ tx('loadingAgentStatus') }}</p>
      </template>

      <template v-else>
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
      </template>
    </aside>

    <div v-if="hasBills" class="voice-bills">
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
