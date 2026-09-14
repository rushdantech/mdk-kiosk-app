<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useT } from '../i18n'
import { loadCitizenBills } from '../store/session'

type KadPhase = 'insert' | 'query'

const router = useRouter()
const tx = useT()
const phase = ref<KadPhase>('insert')
const step = ref(0)
let auto = 0
let queryTick = 0
let queryDone = 0

const querySteps = computed(() => [
  tx.value('kadQueryChip'),
  tx.value('kadQueryIc'),
  tx.value('kadQueryTax'),
  tx.value('kadQuerySummons'),
])

function startQuery(): void {
  if (phase.value === 'query') {
    return
  }
  window.clearTimeout(auto)
  phase.value = 'query'
  step.value = 0
  queryTick = window.setInterval(() => {
    step.value = (step.value + 1) % querySteps.value.length
  }, 700)
  queryDone = window.setTimeout(() => {
    window.clearInterval(queryTick)
    loadCitizenBills('mykad')
    void router.push('/bills')
  }, 4200)
}

onMounted(() => {
  auto = window.setTimeout(startQuery, 3200)
})

onUnmounted(() => {
  window.clearTimeout(auto)
  window.clearInterval(queryTick)
  window.clearTimeout(queryDone)
})
</script>

<template>
  <section class="panel">
    <h1>{{ phase === 'query' ? tx('kadValid') : tx('doorKadTitle') }}</h1>
    <p class="lead">{{ phase === 'query' ? tx('kadQuery') : tx('kadWait') }}</p>

    <div class="slot-card" style="margin-top: 28px">
      <template v-if="phase === 'insert'">
        <p><span class="pulse"></span>{{ tx('kadHint') }}</p>
        <div class="reader" aria-hidden="true">
          <div class="reader-card"></div>
          <div class="reader-slot"></div>
        </div>
        <div class="actions">
          <button type="button" class="ghost" @click="startQuery">
            {{ tx('kadSimulate') }}
          </button>
        </div>
      </template>

      <template v-else>
        <div class="query-stage" aria-live="polite">
          <div class="query-orb" aria-hidden="true">
            <span class="query-ring"></span>
            <span class="query-core"></span>
          </div>
          <p class="query-step">{{ querySteps[step] }}</p>
          <div class="query-bar" aria-hidden="true"><span></span></div>
          <p class="ic">{{ tx('kadQueryHint') }}</p>
        </div>
      </template>
    </div>
  </section>
</template>
