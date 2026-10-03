<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div
    class="mt-3 border-t border-gray-700 pt-3 text-sm"
    :aria-busy="busy"
  >
    <p class="text-gray-400">
      Read-only provider check. No media will be added or moved.
    </p>
    <button
      v-if="hasIntent"
      type="button"
      class="mt-2 rounded border border-gray-500 px-3 py-2 text-blue-300 focus-visible:outline focus-visible:outline-2 disabled:opacity-60"
      :disabled="busy"
      @click="check"
    >
      {{ busy ? 'Checking routing…' : 'Check routing' }}
    </button>
    <p
      v-else
      class="mt-2 text-gray-300"
    >
      No saved destination from this attempt. Review it in Radarr/Sonarr.
    </p>
    <p
      role="status"
      aria-atomic="true"
      class="mt-2 text-gray-300"
    >
      {{ message }}
    </p>
    <p
      v-if="checkedAt"
      class="mt-1 text-xs text-gray-400"
    >
      Last checked: {{ checkedAt }}
    </p>
    <ManualRoutingBackground
      v-if="hasIntent"
      :classification-id="classificationId"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import api from '@/api'
import ManualRoutingBackground from './ManualRoutingBackground.vue'

const props = defineProps({ classificationId: { type: Number, required: true }, details: { type: Object, required: true } })
const busy = ref(false)
const result = ref(null)
const hasIntent = computed(() => props.details.manual_routing_intent?.version === 1)
const savedMessages = {
  verified_present: 'Found in the saved destination. This does not prove which request added it.',
  not_present: 'Not found in the provider. Review before retrying.',
  mismatch: 'The provider item did not match the saved destination.',
  unavailable: 'The previous check could not verify routing.',
}
const message = computed(() => result.value?.message || savedMessages[props.details.manual_routing_observation?.reason] || '')
const checkedAt = computed(() => {
  const value = result.value?.checkedAt || (!result.value && props.details.manual_routing_observation?.checkedAt)
  const date = value ? new Date(value) : null
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString() : ''
})
async function check() {
  if (busy.value) return
  busy.value = true
  result.value = { message: 'Checking the saved destination…' }
  try {
    const response = await api.checkManualRouting(props.classificationId)
    result.value = response.data
  } catch (error) {
    result.value = { message: error?.response?.status === 403 ? 'An administrator must run this check.'
      : error?.response?.status === 429 ? 'A check is already running or the limit was reached. Try again shortly.'
        : 'Could not check routing. Try again later.' }
  } finally { busy.value = false }
}
</script>
