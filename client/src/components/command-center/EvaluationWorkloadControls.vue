<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <details
    class="workload"
    @toggle="opened"
  >
    <summary>Background AI settings</summary>
    <p>These comparisons use your local Ollama model. They do not move media or change policies.</p>
    <p>Applies to this installation only. A shared Ollama server may be busy with other applications.</p>
    <button
      type="button"
      :disabled="loading || saving"
      @click="load"
    >
      Refresh settings
    </button>
    <p
      role="status"
      aria-live="polite"
    >
      {{ message }}
    </p>
    <form
      v-if="state"
      @submit.prevent="save"
    >
      <fieldset :disabled="loading || saving || conflict">
        <label>Background evaluation
          <select v-model="mode">
            <option
              v-for="(label, key) in workloadModes"
              :key="key"
              :value="key"
            >{{ label }}</option>
          </select>
        </label>
        <template v-if="mode !== 'off'">
          <label>Daily request safety limit (UTC)
            <input
              v-model.number="dailyRequests"
              type="number"
              min="1"
              max="200"
              step="1"
              required
            >
          </label>
          <p>A work limit, not a charge. Failed or cancelled attempts still count; changing settings does not reset them.</p>
        </template>
        <div
          v-if="mode === 'scheduled'"
          class="times"
        >
          <label>Start (UTC)<input
            v-model="start"
            type="time"
            required
          ></label>
          <label>End (UTC)<input
            v-model="end"
            type="time"
            required
          ></label>
          <p>Runs daily within this window, only when this installation is idle. Overnight windows are supported.</p>
        </div>
        <p v-else-if="mode === 'when_idle'">
          Runs automatically when this installation is idle. You do not need to keep this page open.
        </p>
        <p v-else>
          Stops new background requests. Ollama may finish a request already sent.
        </p>
        <button type="submit">
          {{ saving ? 'Saving…' : 'Save background settings' }}
        </button>
      </fieldset>
      <p>Saved mode: {{ workloadModes[state.mode] }}.</p>
      <p v-if="state.quotaDay">
        Requests reserved for {{ state.quotaDay }} (UTC): {{ state.requestsReserved }}.
      </p>
      <p>Memory safeguards, cooldowns and normal classification priority remain in effect.</p>
    </form>
  </details>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { getEvaluationWorkload, updateEvaluationWorkload } from '@/api/evaluationHistoryApi'
import { readEvaluationWorkload, workloadModes, workloadMinute, workloadTime } from '@/utils/evaluationWorkload'

const emit = defineEmits(['saved'])
const state = ref(null), loading = ref(false), saving = ref(false), conflict = ref(false), message = ref('')
const mode = ref('off'), dailyRequests = ref(5), start = ref('00:00'), end = ref('06:00')
let disposed = false
onBeforeUnmount(() => { disposed = true })
function accept(value) {
  const result = readEvaluationWorkload(value)
  if (!result) throw new Error('invalid_workload_status')
  state.value = result
  mode.value = result.mode
  dailyRequests.value = result.dailyRequests || 5
  start.value = workloadTime(result.startMinute) || '00:00'
  end.value = workloadTime(result.endMinute) || '06:00'
  conflict.value = false
}
async function load() {
  if (loading.value || saving.value) return
  loading.value = true; message.value = 'Loading settings…'
  try {
    const result = await getEvaluationWorkload()
    if (disposed) return
    accept(result); message.value = ''
  } catch {
    if (!disposed) { state.value = null; message.value = 'Settings are unavailable. Refresh to try again.' }
  } finally { if (!disposed) loading.value = false }
}
function opened(event) {
  if (event.target.open && !state.value) void load()
}
async function save() {
  if (!state.value || saving.value || loading.value || conflict.value) return
  const scheduled = mode.value === 'scheduled'
  const startMinute = scheduled ? workloadMinute(start.value) : null
  const endMinute = scheduled ? workloadMinute(end.value) : null
  if (scheduled && (startMinute === null || endMinute === null || startMinute === endMinute)) {
    message.value = 'Choose different, valid start and end times.'; return
  }
  if (mode.value !== 'off' && (!Number.isInteger(dailyRequests.value) || dailyRequests.value < 1 || dailyRequests.value > 200)) {
    message.value = 'Choose a daily request limit from 1 to 200.'; return
  }
  saving.value = true; message.value = 'Saving settings…'
  try {
    const response = await updateEvaluationWorkload({ revision: state.value.revision, mode: mode.value,
      dailyRequests: mode.value === 'off' ? 0 : dailyRequests.value, startMinute, endMinute })
    if (disposed) return
    accept(response.data); emit('saved'); message.value = 'Settings saved. Background checks run without this page open.'
  } catch (error) {
    if (disposed) return
    // An uncertain write must be read back before another edit, never automatically repeated.
    conflict.value = true
    message.value = error.response?.status === 409
      ? 'Settings changed elsewhere. Refresh before editing again.'
      : 'Could not confirm the save. Refresh settings before trying again.'
  } finally { if (!disposed) saving.value = false }
}
</script>

<style scoped>
.workload { margin-top: .75rem; font-size: .875rem; }
summary { cursor: pointer; }
p, button, label { margin-top: .5rem; }
label { display: flex; flex-direction: column; gap: .25rem; max-width: 24rem; }
input, select, button { color: inherit; background: var(--bg-secondary, #1f2937); border: 1px solid #64748b; padding: .5rem; border-radius: .3rem; }
fieldset { border: 0; padding: 0; }
:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
button:disabled { opacity: .6; }
</style>
