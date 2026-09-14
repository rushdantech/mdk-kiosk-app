<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { DEMO_CITIZEN, maskIc } from '../data/fixtures'
import { useT } from '../i18n'
import { loadCitizenBills, session } from '../store/session'

const router = useRouter()
const tx = useT()
const detected = ref(false)
let auto = 0

const foundLine = computed(() =>
  session.lang === 'ms'
    ? 'Tiga rekod dijumpai: cukai taksiran, kompaun trafik, dan kompaun lesen.'
    : 'Three records found: assessment, traffic compound, and licence compound.',
)

function detect(): void {
  detected.value = true
}

function continueToBills(): void {
  loadCitizenBills('mykad')
  void router.push('/bills')
}

onMounted(() => {
  auto = window.setTimeout(detect, 3200)
})

onUnmounted(() => {
  window.clearTimeout(auto)
})
</script>

<template>
  <section class="panel">
    <h1>{{ detected ? tx('kadFound') : tx('doorKadTitle') }}</h1>
    <p class="lead">{{ detected ? DEMO_CITIZEN.name : tx('kadWait') }}</p>

    <div class="slot-card" style="margin-top: 28px">
      <template v-if="!detected">
        <p><span class="pulse"></span>{{ tx('kadHint') }}</p>
        <div class="reader" aria-hidden="true">
          <div class="reader-card"></div>
          <div class="reader-slot"></div>
        </div>
        <div class="actions">
          <button type="button" class="ghost" @click="detect">
            {{ tx('kadSimulate') }}
          </button>
        </div>
      </template>
      <template v-else>
        <p class="ic">{{ DEMO_CITIZEN.shortName }} · MyKad {{ maskIc(DEMO_CITIZEN.ic) }}</p>
        <p class="lead">{{ foundLine }}</p>
        <div class="actions">
          <button type="button" class="solid" @click="continueToBills">
            {{ tx('continue') }}
          </button>
        </div>
      </template>
    </div>
  </section>
</template>
