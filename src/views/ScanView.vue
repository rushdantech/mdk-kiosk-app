<script setup lang="ts">
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { findBillByScanCode, money } from '../data/fixtures'
import { billDetail, billTitle, useT } from '../i18n'
import { loadSingleBill } from '../store/session'
import type { Bill } from '../types'

type Detector = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>
}

const router = useRouter()
const tx = useT()
const video = ref<HTMLVideoElement | null>(null)
const cameraOn = ref(false)
const cameraError = ref(false)
const found = ref<Bill | null>(null)
const unknown = ref('')
let stream: MediaStream | null = null
let scanTimer = 0
let zxing: IScannerControls | null = null
let locked = false

const status = computed(() => {
  if (found.value) {
    return tx.value('foundPaper')
  }
  if (cameraError.value) {
    return tx.value('scanNeedCamera')
  }
  return tx.value('scanListening')
})

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
  found.value = bill
  stopScanner()
}

function stopScanner(): void {
  window.clearInterval(scanTimer)
  zxing?.stop()
  zxing = null
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
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
})

function continueFound(): void {
  if (!found.value) {
    return
  }
  loadSingleBill(found.value.id, 'scan')
  void router.push('/bills')
}
</script>

<template>
  <section class="panel">
    <h1>{{ found ? tx('foundPaper') : tx('scanTitle') }}</h1>
    <p class="lead">{{ found ? billTitle(found) : tx('scanLead') }}</p>

    <div class="scan-stage">
      <div class="scan-frame">
        <video v-show="cameraOn" ref="video" muted playsinline></video>
        <div v-if="!cameraOn" class="fallback" aria-hidden="true"></div>
        <div class="finder"></div>
      </div>
      <div class="slot-card">
        <template v-if="!found">
          <p>{{ status }}</p>
          <p class="lead">{{ tx('scanHint') }}</p>
          <p v-if="unknown" class="scan-unknown">
            {{ tx('scanUnknown') }}: {{ unknown }}
          </p>
          <p class="ic">{{ tx('scanCodesHint') }}</p>
          <router-link class="linkish" to="/scan-codes">{{ tx('scanCodesOpen') }}</router-link>
        </template>
        <template v-else>
          <h2>{{ billTitle(found) }}</h2>
          <p class="lead">{{ billDetail(found) }}</p>
          <p class="amount">RM {{ money(found.amount) }}</p>
          <p v-if="found.noticeNo" class="tag">{{ tx('notice') }} {{ found.noticeNo }}</p>
          <p v-else-if="found.accountNo" class="tag">{{ tx('account') }} {{ found.accountNo }}</p>
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
