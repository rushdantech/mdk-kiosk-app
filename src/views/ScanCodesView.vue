<script setup lang="ts">
import JsBarcode from 'jsbarcode'
import { onMounted } from 'vue'
import { SCAN_CODES } from '../data/fixtures'
import { useT } from '../i18n'
import { session } from '../store/session'

const tx = useT()

onMounted(() => {
  for (const item of SCAN_CODES) {
    const svg = document.getElementById(`barcode-${item.code}`)
    if (!svg) {
      continue
    }
    JsBarcode(svg, item.code, {
      format: 'CODE128',
      width: 2,
      height: 88,
      margin: 8,
      displayValue: true,
      fontSize: 18,
      background: '#fffaf1',
      lineColor: '#1b1812',
    })
  }
})

function label(item: (typeof SCAN_CODES)[number]): string {
  return session.lang === 'ms' ? item.labelMs : item.labelEn
}
</script>

<template>
  <section class="panel">
    <h1>{{ tx('scanCodesTitle') }}</h1>
    <p class="lead">{{ tx('scanCodesLead') }}</p>

    <div class="code-grid">
      <article v-for="item in SCAN_CODES" :key="item.code" class="slot-card code-card">
        <p class="ic">{{ label(item) }}</p>
        <svg :id="`barcode-${item.code}`" class="barcode"></svg>
      </article>
    </div>
  </section>
</template>
