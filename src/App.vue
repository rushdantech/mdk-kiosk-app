<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useT } from './i18n'
import { resetSession, session } from './store/session'

const route = useRoute()
const router = useRouter()
const tx = useT()
const clock = ref('')
const staffOpen = ref(false)
let timer = 0

function tick(): void {
  clock.value = new Date().toLocaleString(session.lang === 'ms' ? 'ms-MY' : 'en-MY', {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(() => {
  tick()
  timer = window.setInterval(tick, 15_000)
})

onUnmounted(() => {
  window.clearInterval(timer)
})

const showRestart = computed(() => route.path !== '/')

function setLang(lang: 'ms' | 'en'): void {
  session.lang = lang
  document.documentElement.lang = lang === 'ms' ? 'ms' : 'en'
  tick()
}

function restart(): void {
  resetSession()
  void router.push('/')
}
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <div class="crest" aria-hidden="true">MDK</div>
        <div>
          <small>{{ tx('council') }}</small>
          <strong>{{ tx('brand') }}</strong>
        </div>
      </div>
      <div class="clock">{{ clock }}</div>
      <div class="lang-switch" role="group" :aria-label="tx('langMs')">
        <button type="button" :class="{ on: session.lang === 'ms' }" @click="setLang('ms')">
          BM
        </button>
        <button type="button" :class="{ on: session.lang === 'en' }" @click="setLang('en')">
          EN
        </button>
      </div>
    </header>

    <main class="stage">
      <router-view />
    </main>

    <footer class="footer">
      <p class="note">{{ tx('staffNote') }}</p>
      <div class="actions" style="margin-top: 0">
        <button v-if="showRestart" type="button" class="ghost" @click="restart">
          {{ tx('startOver') }}
        </button>
        <button type="button" class="solid" @click="staffOpen = true">
          {{ tx('help') }}
        </button>
      </div>
    </footer>

    <div v-if="staffOpen" class="modal" role="alertdialog">
      <div class="modal-card">
        <h2>{{ tx('help') }}</h2>
        <p class="lead">
          {{
            session.lang === 'ms'
              ? 'Isyarat dihantar ke kaunter. Seorang kakitangan akan datang ke kiosk ini.'
              : 'A signal was sent to the counter. A staff member will come to this kiosk.'
          }}
        </p>
        <div class="actions">
          <button type="button" class="solid" @click="staffOpen = false">OK</button>
        </div>
      </div>
    </div>
  </div>
</template>
