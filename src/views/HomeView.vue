<script setup lang="ts">
import { useT } from '../i18n'

const tx = useT()
</script>

<template>
  <section class="home">
    <h1 class="home-title">{{ tx('homeTitle') }}</h1>
    <p class="home-lead">{{ tx('homeLead') }}</p>

    <div class="doors">
      <router-link class="door" to="/mykad">
        <svg class="door-art" viewBox="0 0 360 160" aria-hidden="true">
          <rect width="360" height="160" rx="16" fill="#1c4a33" />
          <rect x="70" y="38" width="220" height="84" rx="10" fill="#1f3d7a" />
          <rect x="86" y="54" width="70" height="52" rx="6" fill="#c9a24a" />
          <rect x="168" y="58" width="104" height="10" fill="#efe4cc" />
          <rect x="168" y="80" width="80" height="8" fill="#b9c7a8" />
        </svg>
        <h2>{{ tx('doorKadTitle') }}</h2>
        <p>{{ tx('doorKadBody') }}</p>
        <span class="go">→</span>
      </router-link>

      <router-link class="door" to="/voice">
        <svg class="door-art" viewBox="0 0 360 160" aria-hidden="true">
          <rect width="360" height="160" rx="16" fill="#9a3820" />
          <circle cx="180" cy="80" r="40" fill="#1b1812" />
          <circle cx="180" cy="80" r="22" fill="#f6e7b0" />
        </svg>
        <h2>{{ tx('doorVoiceTitle') }}</h2>
        <p>{{ tx('doorVoiceBody') }}</p>
        <span class="go">→</span>
      </router-link>

      <router-link class="door" to="/scan">
        <svg class="door-art" viewBox="0 0 360 160" aria-hidden="true">
          <rect width="360" height="160" rx="16" fill="#1b1812" />
          <rect x="108" y="28" width="144" height="104" rx="8" fill="#efe4cc" />
          <rect x="120" y="44" width="120" height="18" fill="#1b1812" />
          <rect x="120" y="70" width="88" height="8" fill="#5a5246" />
          <rect x="120" y="86" width="70" height="8" fill="#5a5246" />
        </svg>
        <h2>{{ tx('doorScanTitle') }}</h2>
        <p>{{ tx('doorScanBody') }}</p>
        <span class="go">→</span>
      </router-link>

      <router-link class="door" to="/key-in">
        <svg class="door-art" viewBox="0 0 360 160" aria-hidden="true">
          <rect width="360" height="160" rx="16" fill="#3d4a2a" />
          <rect x="48" y="42" width="264" height="28" rx="6" fill="#efe4cc" />
          <rect x="48" y="84" width="36" height="28" rx="6" fill="#c9a24a" />
          <rect x="92" y="84" width="36" height="28" rx="6" fill="#efe4cc" />
          <rect x="136" y="84" width="36" height="28" rx="6" fill="#efe4cc" />
          <rect x="180" y="84" width="36" height="28" rx="6" fill="#efe4cc" />
          <rect x="224" y="84" width="88" height="28" rx="6" fill="#1b1812" />
        </svg>
        <h2>{{ tx('doorKeyinTitle') }}</h2>
        <p>{{ tx('doorKeyinBody') }}</p>
        <span class="go">→</span>
      </router-link>
    </div>
  </section>
</template>
