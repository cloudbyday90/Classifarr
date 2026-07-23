<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <details
    v-if="enabled"
    class="mt-3 rounded border border-gray-700 bg-background px-3 py-2"
  >
    <summary class="cursor-pointer text-xs font-medium text-gray-100">
      Add a specific value not shown above (optional)
    </summary>
    <p class="mt-2 text-xs text-gray-400">
      Use this only when the connected library does not provide a specific enough value. Classifarr validates it before it can be selected.
    </p>

    <form
      class="mt-3 space-y-3"
      @submit.prevent="submit"
    >
      <label class="block text-xs font-medium text-gray-100">
        Signal type
        <select
          v-model="signalType"
          class="mt-1 block w-full rounded border border-gray-600 bg-background-light px-3 py-2 text-sm text-gray-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="busy"
        >
          <option
            v-for="type in signalTypes"
            :key="type.id"
            :value="type.id"
          >
            {{ type.label }}
          </option>
        </select>
      </label>

      <label class="block text-xs font-medium text-gray-100">
        Value
        <input
          v-model="value"
          class="mt-1 block w-full rounded border border-gray-600 bg-background-light px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          type="text"
          :maxlength="valueMaximumLength"
          :disabled="busy"
          placeholder="For example: Studio Ghibli"
        >
      </label>

      <label class="block text-xs font-medium text-gray-100">
        Why should this define the destination?
        <textarea
          v-model="explanation"
          class="mt-1 block min-h-20 w-full rounded border border-gray-600 bg-background-light px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          :maxlength="explanationMaximumLength"
          :disabled="busy"
          placeholder="Explain why this value belongs in this destination."
        />
      </label>

      <Button
        size="sm"
        variant="outline-solid"
        type="submit"
        :disabled="busy || !canSubmit"
      >
        {{ busy ? 'Checking custom value...' : 'Check custom value' }}
      </Button>

      <p
        v-if="error"
        class="rounded border border-amber-700/70 bg-amber-950/30 px-2 py-1 text-xs text-amber-100"
        role="alert"
      >
        {{ error }}
      </p>
      <p
        v-else-if="message"
        class="rounded border border-blue-800/70 bg-blue-950/30 px-2 py-1 text-xs text-blue-100"
        role="status"
        aria-live="polite"
      >
        {{ message }}
      </p>
    </form>
  </details>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import Button from '@/components/common/Button.vue'

const props = defineProps({
  inputContract: {
    type: Object,
    default: null,
  },
  busy: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
  message: {
    type: String,
    default: '',
  },
})

const emit = defineEmits({
  'validate-custom-signal': payload => Boolean(payload?.signalType && payload?.value && payload?.explanation),
})

const signalTypes = computed(() => Array.isArray(props.inputContract?.signalTypes)
  ? props.inputContract.signalTypes.filter(type => type?.id && type?.label)
  : [])
const enabled = computed(() => props.inputContract?.enabled === true && signalTypes.value.length > 0)
const valueMaximumLength = computed(() => Number(props.inputContract?.valueMaximumLength) || 160)
const explanationMaximumLength = computed(() => Number(props.inputContract?.explanationMaximumLength) || 320)
const signalType = ref('')
const value = ref('')
const explanation = ref('')

watch(signalTypes, (nextSignalTypes) => {
  if (!nextSignalTypes.some(type => type.id === signalType.value)) {
    signalType.value = nextSignalTypes[0]?.id || ''
  }
}, { immediate: true })

const canSubmit = computed(() => Boolean(
  signalType.value && value.value.trim() && explanation.value.trim()
))

const submit = () => {
  if (!canSubmit.value || props.busy) return

  emit('validate-custom-signal', {
    signalType: signalType.value,
    value: value.value,
    explanation: explanation.value,
  })
}
</script>
