<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { money } from '../data/fixtures'
import { useT } from '../i18n'
import { resetSession, selectedTotal, session } from '../store/session'

const router = useRouter()
const tx = useT()

onMounted(() => {
  if (!session.receiptNo) {
    void router.replace('/')
  }
})

function another(): void {
  resetSession()
  void router.push('/')
}
</script>

<template>
  <section class="panel">
    <h1>{{ tx('doneTitle') }}</h1>
    <p class="lead">{{ tx('doneLead') }}</p>
    <div class="done-box">
      <p class="ic">{{ tx('receipt') }}</p>
      <p class="receipt">{{ session.receiptNo }}</p>
      <p class="amount">RM {{ money(selectedTotal) }}</p>
      <p class="lead">
        {{ session.payMethod === 'card' ? tx('card') : tx('duitnow') }}
      </p>
      <div class="actions">
        <button type="button" class="solid" @click="another">{{ tx('another') }}</button>
      </div>
    </div>
  </section>
</template>
