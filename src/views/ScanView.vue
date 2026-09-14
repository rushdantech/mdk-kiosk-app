<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { DEMO_BILLS, money } from '../data/fixtures'
import { billDetail, billTitle, useT } from '../i18n'
import { loadSingleBill } from '../store/session'

const router = useRouter()
const tx = useT()
const video = ref<HTMLVideoElement | null>(null)
const cameraOn = ref(false)
const foundId = ref<string | null>(null)
let stream: MediaStream | null = null
let auto = 0

const sample = DEMO_BILLS[1]

onMounted(async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    })
    if (video.value) {
      video.value.srcObject = stream
      await video.value.play()
      cameraOn.value = true
    }
  } catch {
    cameraOn.value = false
  }
  auto = window.setTimeout(simulate, 4000)
})

onUnmounted(() => {
  window.clearTimeout(auto)
  stream?.getTracks().forEach((track) => track.stop())
})

function simulate(): void {
  foundId.value = sample.id
}

function continueFound(): void {
  if (!foundId.value) {
    return
  }
  loadSingleBill(foundId.value, 'scan')
  void router.push('/bills')
}
</script>

<template>
  <section class="panel">
    <h1>{{ foundId ? tx('foundPaper') : tx('scanTitle') }}</h1>
    <p class="lead">{{ foundId ? billTitle(sample) : tx('scanLead') }}</p>

    <div class="scan-stage">
      <div class="scan-frame">
        <video v-show="cameraOn" ref="video" muted playsinline></video>
        <div v-if="!cameraOn" class="fallback" aria-hidden="true"></div>
        <div class="finder"></div>
      </div>
      <div class="slot-card">
        <template v-if="!foundId">
          <p>{{ tx('scanHint') }}</p>
          <div class="actions">
            <button type="button" class="ghost" @click="simulate">
              {{ tx('scanDemo') }}
            </button>
          </div>
        </template>
        <template v-else>
          <h2>{{ billTitle(sample) }}</h2>
          <p class="lead">{{ billDetail(sample) }}</p>
          <p class="amount">RM {{ money(sample.amount) }}</p>
          <p class="tag">{{ tx('notice') }} {{ sample.noticeNo }}</p>
          <div class="actions">
            <button type="button" class="solid" @click="continueFound">
              {{ tx('continue') }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
