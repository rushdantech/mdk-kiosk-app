<script setup lang="ts">
import { useT } from '../i18n'

const emit = defineEmits<{
  type: [value: string]
  backspace: []
  clear: []
}>()

const tx = useT()

const letters = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
]
const extras = ['-', '.', '@']
const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
</script>

<template>
  <div class="kb" role="group" :aria-label="tx('keyboard')">
    <div class="kb-alpha">
      <div v-for="(row, index) in letters" :key="index" class="kb-row">
        <button
          v-for="key in row"
          :key="key"
          type="button"
          class="kb-key"
          @click="emit('type', key)"
        >
          {{ key }}
        </button>
      </div>
      <div class="kb-row">
        <button type="button" class="kb-key wide" @click="emit('clear')">
          {{ tx('clear') }}
        </button>
        <button
          v-for="key in extras"
          :key="key"
          type="button"
          class="kb-key"
          @click="emit('type', key)"
        >
          {{ key }}
        </button>
        <button type="button" class="kb-key wide" @click="emit('type', ' ')">
          {{ tx('space') }}
        </button>
        <button type="button" class="kb-key wide" @click="emit('backspace')">⌫</button>
      </div>
    </div>
    <div class="kb-num">
      <button
        v-for="key in digits"
        :key="key"
        type="button"
        class="kb-key"
        @click="emit('type', key)"
      >
        {{ key }}
      </button>
    </div>
  </div>
</template>
