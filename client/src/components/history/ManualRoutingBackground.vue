<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <details
    class="mt-3"
    @toggle="onToggle"
  >
    <summary class="cursor-pointer text-blue-300 focus-visible:outline focus-visible:outline-2">
      Background routing checks
    </summary>
    <div
      :aria-busy="busy"
      class="mt-2 space-y-2"
    >
      <p>Admin-only. Up to 3 checks for this item; no automatic adds. Off by default.</p>
      <p v-if="state">
        {{ state.enabled ? (state.provider ? 'Paused' : 'On') : 'Off' }} · {{ state.attempts }} of 3 checks used.
        {{ outcome }}
      </p>
      <p v-if="nextCheck">
        {{ state.provider && state.provider.reason !== 'provider_paused' ? 'Manual recheck after:' : 'Next eligible check:' }} {{ nextCheck }}
      </p>
      <button
        v-if="state"
        type="button"
        class="rounded border border-gray-500 px-3 py-2 text-blue-300 focus-visible:outline focus-visible:outline-2 disabled:opacity-60"
        :disabled="busy || (!state.enabled && state.attempts >= 3)"
        @click="toggleEnabled"
      >
        {{ state.enabled ? 'Turn off checks' : 'Enable checks for this item' }}
      </button>
      <button
        type="button"
        class="ml-2 rounded border border-gray-500 px-3 py-2 text-blue-300 focus-visible:outline focus-visible:outline-2 disabled:opacity-60"
        :disabled="busy"
        @click="refresh"
      >
        Refresh check status
      </button>
      <p v-if="state?.attempts >= 3">
        Automatic limit reached. Review the item before using Check routing again.
      </p>
      <p
        role="status"
        aria-atomic="true"
      >
        {{ message }}
      </p>
    </div>
  </details>
</template>

<script setup>
import { computed, ref } from 'vue'
import api from '@/api'

const props = defineProps({ classificationId: { type: Number, required: true } })
const busy = ref(false), state = ref(null), message = ref('')
const outcomes = {
  checking: 'A check started; its result may still be pending.',
  verified_present: 'Found in the saved destination. No add was attempted.',
  not_present: 'Not found yet. Review in Radarr/Sonarr if checks run out.',
  mismatch: 'The item is in a different destination. Review in Radarr/Sonarr.',
  unavailable: 'Provider check unavailable. Check its connection.',
  configuration_changed: 'Settings changed. Review the original destination.',
  not_eligible: 'The saved intent is no longer eligible. Review this item.',
  changed: 'The record changed during a check. Refresh History.',
  provider_paused: 'The provider was paused. No item allowance was used.',
  provider_auth_required: 'The last check rejected provider access. Review its API key and permissions.',
  provider_configuration_required: 'The last check found a provider settings problem. Review its endpoint and settings.',
}
const providerMessages = {
  provider_paused: 'Provider unavailable or rate-limited. Checks resume after its cooldown; item allowance is preserved.',
  provider_auth_required: 'Automatic checks paused. Fix provider access, then use Check routing after the cooldown.',
  provider_configuration_required: 'Automatic checks paused. Review provider settings, then use Check routing after the cooldown.',
}
const outcome = computed(() => providerMessages[state.value?.provider?.reason] || outcomes[state.value?.lastResult] || '')
const nextCheck = computed(() => {
  if (!state.value?.enabled || !state.value.nextCheckAt) return ''
  const provider = state.value.provider
  const providerTime = new Date(provider?.nextCheckAt).getTime()
  const itemTime = new Date(state.value.nextCheckAt).getTime()
  const date = new Date(Number.isFinite(providerTime) ? Math.max(itemTime, providerTime) : itemTime)
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : ''
})
function reportError(error) {
  message.value = error?.response?.status === 403 ? 'An administrator must manage these checks.'
    : error?.response?.status === 409 ? 'The saved destination is no longer eligible. Review it in Radarr/Sonarr.'
      : error?.response?.status === 429 ? 'The check limit was reached. Wait a minute before refreshing.'
      : 'Could not load or save check settings. Refresh before trying again.'
}
async function refresh() {
  if (busy.value) return
  busy.value = true
  try {
    state.value = await api.getManualRoutingBackground(props.classificationId)
    message.value = `Check status refreshed. ${outcome.value}`
  }
  catch (error) { state.value = null; reportError(error) }
  finally { busy.value = false }
}
function onToggle(event) {
  if (event.target.open && !state.value) refresh()
}
async function toggleEnabled() {
  if (busy.value || !state.value) return
  busy.value = true
  try {
    const response = await api.setManualRoutingBackground(props.classificationId, !state.value.enabled)
    state.value = response.data
    message.value = state.value.enabled ? `Background checks enabled for this item. ${outcome.value}`
      : 'Background checks are off. An already started check may finish.'
  } catch (error) { state.value = null; reportError(error) }
  finally { busy.value = false }
}
</script>
