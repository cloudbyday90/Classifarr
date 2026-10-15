<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    class="rounded-lg border border-gray-700 p-4"
    aria-labelledby="ollama-work-history-title"
  >
    <h3
      id="ollama-work-history-title"
      class="font-semibold"
    >
      Ollama gateway history
    </h3>
    <p class="mt-1 text-sm text-gray-400">
      Requests from this installation. Loading history does not run AI.
    </p>
    <form
      class="mt-3 flex flex-wrap items-end gap-3"
      @submit.prevent="load()"
    >
      <label class="text-sm">
        Queue task ID (optional)
        <input
          v-model="taskId"
          :disabled="loading"
          inputmode="numeric"
          maxlength="19"
          class="mt-1 block rounded border border-gray-600 bg-gray-900 p-2"
        >
      </label>
      <button
        type="submit"
        :disabled="loading"
        class="rounded bg-primary px-3 py-2 disabled:opacity-50"
      >
        {{ loading ? 'Loading…' : 'Load latest' }}
      </button>
    </form>
    <p
      v-if="error"
      class="mt-3 text-red-300"
      role="alert"
    >
      {{ error }}
    </p>
    <div
      class="mt-3"
      role="status"
      aria-live="polite"
    >
      <p v-if="loading">
        Loading gateway history…
      </p>
      <p v-else-if="report?.state === 'not_configured'">
        The optional gateway is not configured. Direct Ollama requests are not recorded here.
      </p>
      <template v-else-if="report?.state === 'available'">
        <p class="text-sm text-gray-400">
          Installation: {{ report.installation }} · {{ appliedTask ? `Task ${appliedTask}` : 'All tasks' }}
        </p>
        <p
          v-if="!report.items.length"
          class="mt-2"
        >
          No recorded requests match this view.
        </p>
        <ol
          v-else
          class="mt-3 space-y-3"
        >
          <li
            v-for="item in report.items"
            :key="item.requestId"
            class="rounded border border-gray-700 p-3"
          >
            <p class="font-medium">
              {{ labels[item.outcome.state] || 'Outcome not recorded' }}
            </p>
            <p class="text-sm">
              {{ item.source ? `Task ${item.source.taskId} · ${item.source.taskType} · task attempt ${item.source.attempt}` : 'No task reference recorded' }}
            </p>
            <p class="text-sm text-gray-400">
              {{ item.model || 'Model not recorded' }} · {{ item.operation === '/api/embed' ? 'Embedding' : item.operation === '/api/generate' ? 'Generation' : 'Operation not recorded' }}
            </p>
            <p class="text-sm text-gray-400">
              Admitted: {{ item.admittedAt }} · gateway attempt {{ item.gatewayAttempt }}
            </p>
            <p
              v-if="item.outcome.recordedAt"
              class="text-sm text-gray-400"
            >
              Outcome recorded: {{ item.outcome.recordedAt }}
            </p>
            <p
              v-if="item.outcome.httpStatus"
              class="text-sm text-gray-400"
            >
              Provider HTTP status: {{ item.outcome.httpStatus }}
            </p>
            <p class="break-all text-xs text-gray-400">
              Request: {{ item.requestId }}
            </p>
          </li>
        </ol>
        <p class="mt-3 text-xs text-gray-400">
          A completed provider response does not mean the queue task succeeded. History does not authorize retries or cancellation.
        </p>
      </template>
    </div>
    <button
      v-if="report?.nextBefore"
      type="button"
      :disabled="loading"
      class="mt-3 rounded border border-gray-600 px-3 py-2"
      @click="load(report.nextBefore)"
    >
      Older requests
    </button>
  </section>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue'
import api from '@/api'

const taskId = ref(''), appliedTask = ref(''), report = ref(null), loading = ref(false), error = ref('')
const labels = {
  response_completed: 'Provider response completed', provider_rejected: 'Provider rejected request',
  not_dispatched: 'Cancelled before dispatch', completion_observed: 'Completion recorded; detail unavailable',
  active_or_uncertain: 'Active or outcome uncertain', abandoned_after_review: 'Abandoned after administrator review',
  outcome_not_recorded: 'Outcome not recorded',
}
let controller, sequence = 0
async function load(before) {
  const current = ++sequence
  controller?.abort()
  const filter = before ? appliedTask.value : taskId.value.trim()
  error.value = ''; report.value = null; loading.value = false
  if (filter && (!/^[1-9][0-9]{0,18}$/.test(filter) || BigInt(filter) > 9223372036854775807n)) {
    error.value = 'Enter a positive queue task ID.'; return
  }
  controller = new AbortController(); loading.value = true
  try {
    const result = await api.getOllamaWorkHistory({ ...(filter ? { taskId: filter } : {}), ...(before ? { before } : {}) }, controller.signal)
    if (current !== sequence) return
    report.value = result; appliedTask.value = filter
  } catch {
    if (current === sequence) error.value = 'Gateway history is unavailable. Check the gateway connection and try again.'
  } finally { if (current === sequence) loading.value = false }
}
onBeforeUnmount(() => { sequence++; controller?.abort() })
</script>
