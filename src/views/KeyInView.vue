<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import OnScreenKeyboard from '../components/OnScreenKeyboard.vue'
import { findBills } from '../data/fixtures'
import { useT } from '../i18n'
import { loadBills } from '../store/session'

type Service = 'assessment' | 'compound'
type CompoundMode = 'id' | 'notice' | 'plate'
type Field = 'account' | 'id' | 'notice' | 'plate'

const router = useRouter()
const tx = useT()
const service = ref<Service>('assessment')
const compoundMode = ref<CompoundMode>('id')
const focused = ref<Field>('account')
const accountNo = ref('')
const idNo = ref('')
const noticeNo = ref('')
const plate = ref('')
const checking = ref(false)
const error = ref<'assessment' | 'compound' | null>(null)
const sampleOpen = ref(false)

const canSearch = computed(() => {
  if (service.value === 'assessment') {
    return accountNo.value.trim().length > 0 || idNo.value.trim().length > 0
  }
  if (compoundMode.value === 'id') {
    return idNo.value.trim().length > 0
  }
  if (compoundMode.value === 'notice') {
    return noticeNo.value.trim().length > 0
  }
  return plate.value.trim().length > 0
})

function setService(next: Service): void {
  service.value = next
  error.value = null
  focused.value = next === 'assessment' ? 'account' : 'id'
}

function setCompoundMode(next: CompoundMode): void {
  compoundMode.value = next
  focused.value = next === 'id' ? 'id' : next === 'notice' ? 'notice' : 'plate'
}

function typeKey(value: string): void {
  const map: Record<Field, typeof accountNo> = {
    account: accountNo,
    id: idNo,
    notice: noticeNo,
    plate,
  }
  const target = map[focused.value]
  if (target.value.length >= 20) {
    return
  }
  target.value += value
}

function backspace(): void {
  const map: Record<Field, typeof accountNo> = {
    account: accountNo,
    id: idNo,
    notice: noticeNo,
    plate,
  }
  const target = map[focused.value]
  target.value = target.value.slice(0, -1)
}

function clearField(): void {
  const map: Record<Field, typeof accountNo> = {
    account: accountNo,
    id: idNo,
    notice: noticeNo,
    plate,
  }
  map[focused.value].value = ''
}

function search(): void {
  if (!canSearch.value || checking.value) {
    return
  }
  checking.value = true
  window.setTimeout(() => {
    const found =
      service.value === 'assessment'
        ? findBills({
            kind: 'assessment',
            accountNo: accountNo.value,
            idNo: idNo.value,
          })
        : findBills({
            kind: 'compound',
            idNo: compoundMode.value === 'id' ? idNo.value : '',
            noticeNo: compoundMode.value === 'notice' ? noticeNo.value : '',
            plate: compoundMode.value === 'plate' ? plate.value : '',
          })
    checking.value = false
    if (found.length === 0) {
      error.value = service.value
      return
    }
    loadBills(found, 'keyin')
    void router.push('/bills')
  }, 700)
}
</script>

<template>
  <section class="panel">
    <h1>{{ tx('keyinTitle') }}</h1>
    <p class="lead">{{ tx('keyinLead') }}</p>

    <div class="service-tabs" role="tablist">
      <button
        type="button"
        role="tab"
        :aria-selected="service === 'assessment'"
        :class="{ on: service === 'assessment' }"
        @click="setService('assessment')"
      >
        {{ tx('keyinAssessment') }}
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="service === 'compound'"
        :class="{ on: service === 'compound' }"
        @click="setService('compound')"
      >
        {{ tx('keyinCompound') }}
      </button>
    </div>

    <form class="keyin-form" @submit.prevent="search">
      <template v-if="service === 'assessment'">
        <div class="field">
          <div class="field-label">
            <span>{{ tx('account') }}</span>
            <button type="button" class="linkish" @click="sampleOpen = true">
              {{ tx('sample') }}
            </button>
          </div>
          <input
            :value="accountNo"
            readonly
            :class="{ focus: focused === 'account' }"
            :placeholder="'T-070017708-08'"
            @click="focused = 'account'"
          />
          <small>{{ tx('accountHint') }}</small>
        </div>
        <label class="field">
          <span class="field-label">{{ tx('idNumber') }}</span>
          <input
            :value="idNo"
            readonly
            :class="{ focus: focused === 'id' }"
            placeholder="650514086361"
            @click="focused = 'id'"
          />
          <small>{{ tx('idHint') }}</small>
        </label>
      </template>

      <template v-else>
        <p class="ic">{{ tx('searchBy') }}</p>
        <div class="service-tabs slim" role="tablist">
          <button
            type="button"
            :class="{ on: compoundMode === 'id' }"
            @click="setCompoundMode('id')"
          >
            {{ tx('idNumber') }}
          </button>
          <button
            type="button"
            :class="{ on: compoundMode === 'notice' }"
            @click="setCompoundMode('notice')"
          >
            {{ tx('noticeNumber') }}
          </button>
          <button
            type="button"
            :class="{ on: compoundMode === 'plate' }"
            @click="setCompoundMode('plate')"
          >
            {{ tx('plateNumber') }}
          </button>
        </div>
        <label v-if="compoundMode === 'id'" class="field">
          <span class="field-label">{{ tx('idNumber') }}</span>
          <input
            :value="idNo"
            readonly
            class="focus"
            placeholder="650514086361"
            @click="focused = 'id'"
          />
          <small>{{ tx('idHint') }}</small>
        </label>
        <label v-else-if="compoundMode === 'notice'" class="field">
          <span class="field-label">{{ tx('noticeNumber') }}</span>
          <input
            :value="noticeNo"
            readonly
            class="focus"
            placeholder="K58260902003"
            @click="focused = 'notice'"
          />
          <small>{{ tx('noticeHint') }}</small>
        </label>
        <label v-else class="field">
          <span class="field-label">{{ tx('plateNumber') }}</span>
          <input
            :value="plate"
            readonly
            class="focus"
            placeholder="SB4811K"
            @click="focused = 'plate'"
          />
          <small>{{ tx('plateHint') }}</small>
        </label>
      </template>

      <button type="submit" class="solid" :disabled="!canSearch || checking">
        {{ checking ? tx('checking') : tx('enterDetails') }}
      </button>
    </form>

    <OnScreenKeyboard @type="typeKey" @backspace="backspace" @clear="clearField" />

    <div v-if="sampleOpen" class="modal" role="dialog">
      <div class="modal-card">
        <h2>{{ tx('sampleTitle') }}</h2>
        <p class="lead">{{ tx('account') }} T-070017708-08</p>
        <p class="lead">{{ tx('idNumber') }} 650514086361</p>
        <div class="actions">
          <button
            type="button"
            class="solid"
            @click="accountNo = 'T-070017708-08'; idNo = '650514086361'; sampleOpen = false; focused = 'account'"
          >
            {{ tx('useSample') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="error" class="modal" role="alertdialog">
      <div class="modal-card">
        <h2>{{ tx('notFound') }}</h2>
        <p class="lead">
          {{ error === 'assessment' ? tx('notFoundAssessment') : tx('notFoundCompound') }}
        </p>
        <div class="actions">
          <button type="button" class="solid" @click="error = null">OK</button>
        </div>
      </div>
    </div>
  </section>
</template>
