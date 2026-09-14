<script setup lang="ts">
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { findBillByScanCode } from '../data/fixtures'
import { useT } from '../i18n'
import { loadSingleBill } from '../store/session'
import type { Bill } from '../types'

type Detector = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>
}

type ScanPhase = 'scan' | 'query'

const router = useRouter()
const tx = useT()
const video = ref<HTMLVideoElement | null>(null)
const cameraOn = ref(false)
const cameraError = ref(false)
const phase = ref<ScanPhase>('scan')
const scanned = ref<Bill | null>(null)
const unknown = ref('')
const step = ref(0)
let stream: MediaStream | null = null
let scanTimer = 0
let queryTick = 0
let queryDone = 0
let zxing: IScannerControls | null = null
let locked = false

const querySteps = computed(() => {
  const steps = [tx.value('scanQueryCode'), tx.value('scanQueryRecord')]
  if (scanned.value?.kind === 'assessment') {
    steps.push(tx.value('scanQueryAssessment'))
  } else {
    steps.push(tx.value('scanQuerySummons'))
  }
  return steps
})

const status = computed(() => {
  if (phase.value === 'query') {
    return tx.value('scanQuery')
  }
  if (cameraError.value) {
    return tx.value('scanNeedCamera')
  }
  return tx.value('scanListening')
})

function startQuery(bill: Bill): void {
  scanned.value = bill
  phase.value = 'query'
  step.value = 0
  queryTick = window.setInterval(() => {
    step.value = (step.value + 1) % querySteps.value.length
  }, 700)
  queryDone = window.setTimeout(() => {
    window.clearInterval(queryTick)
    loadSingleBill(bill.id, 'scan')
    void router.push('/bills')
  }, 3800)
}

function acceptCode(raw: string): void {
  if (locked) {
    return
  }
  const bill = findBillByScanCode(raw)
  if (!bill) {
    unknown.value = raw
    return
  }
  locked = true
  unknown.value = ''
  stopScanner()
  startQuery(bill)
}

function stopScanner(): void {
  window.clearInterval(scanTimer)
  zxing?.stop()
  zxing = null
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
  cameraOn.value = false
}

async function startDetector(track: HTMLVideoElement): Promise<boolean> {
  const Detector = (
    window as Window & { BarcodeDetector?: new (options?: { formats: string[] }) => Detector }
  ).BarcodeDetector
  if (!Detector) {
    return false
  }
  const detector = new Detector({
    formats: ['code_128', 'code_39', 'code_93', 'codabar', 'ean_13', 'ean_8', 'itf', 'upc_a', 'upc_e', 'qr_code'],
  })
  scanTimer = window.setInterval(() => {
    if (locked || track.readyState < 2) {
      return
    }
    void detector
      .detect(track)
      .then((codes) => {
        const value = codes[0]?.rawValue
        if (value) {
          acceptCode(value)
        }
      })
      .catch(() => undefined)
  }, 250)
  return true
}

async function startZxing(track: HTMLVideoElement): Promise<void> {
  if (!stream) {
    return
  }
  const reader = new BrowserMultiFormatReader()
  zxing = await reader.decodeFromStream(stream, track, (result) => {
    if (result) {
      acceptCode(result.getText())
    }
  })
}

onMounted(async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    })
    if (!video.value) {
      return
    }
    video.value.srcObject = stream
    await video.value.play()
    cameraOn.value = true
    const native = await startDetector(video.value)
    if (!native) {
      await startZxing(video.value)
    }
  } catch {
    cameraError.value = true
    cameraOn.value = false
  }
})

onUnmounted(() => {
  stopScanner()
  window.clearInterval(queryTick)
  window.clearTimeout(queryDone)
})
</script>

<template>
  <section class="panel">
    <h1>{{ phase === 'query' ? tx('scanValid') : tx('scanTitle') }}</h1>
    <p class="lead">{{ phase === 'query' ? tx('scanQuery') : tx('scanLead') }}</p>

    <div v-if="phase === 'scan'" class="scan-stage">
      <div class="scan-frame">
        <video v-show="cameraOn" ref="video" muted playsinline></video>
        <div v-if="!cameraOn" class="fallback" aria-hidden="true"></div>
        <div class="finder"></div>
      </div>
      <div class="slot-card">
        <p>{{ status }}</p>
        <p class="lead">{{ tx('scanHint') }}</p>
        <p v-if="unknown" class="scan-unknown">
          {{ tx('scanUnknown') }}: {{ unknown }}
        </p>
        <p class="ic">{{ tx('scanCodesHint') }}</p>
        <router-link class="linkish" to="/scan-codes">{{ tx('scanCodesOpen') }}</router-link>
      </div>
    </div>

    <div v-else class="slot-card" style="margin-top: 28px">
      <div class="query-stage" aria-live="polite" aria-busy="true">
        <div class="query-orb" aria-hidden="true">
          <span class="query-ring"></span>
          <span class="query-core"></span>
        </div>
        <p class="query-step">{{ querySteps[step] }}</p>
        <div class="query-bar" aria-hidden="true"><span></span></div>
        <p class="ic">{{ tx('scanQueryHint') }}</p>
      </div>
    </div>
  </section>
</template>
