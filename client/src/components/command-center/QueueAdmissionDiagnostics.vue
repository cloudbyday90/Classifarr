<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    v-if="hasPresentation"
    class="queue-admission-diagnostics"
    aria-label="Queue admission status"
    aria-live="polite"
  >
    <div v-if="workerPresentation">
      <p class="queue-admission-diagnostics-label">
        Queue admission
      </p>
      <p class="queue-admission-diagnostics-message">
        {{ workerPresentation.message }}
      </p>
    </div>

    <div v-if="strictVerificationModelChanged">
      <p class="queue-admission-diagnostics-label">
        Strict verification
      </p>
      <p class="queue-admission-diagnostics-message">
        The saved Ollama model changed after strict verification. Candidate verification will not call AI until the saved configuration is tested again.
      </p>
      <button
        type="button"
        class="queue-admission-diagnostics-action"
        @click="$emit('open-ai-settings')"
      >
        Open AI Settings
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  diagnostics: { type: Object, default: null },
})

defineEmits(['open-ai-settings'])

const WORKER_PRESENTATIONS = Object.freeze({
  worker_not_running: Object.freeze({
    message: 'The classification worker is not running, so no eligible worker can take this queued task.',
  }),
  no_eligible_worker: Object.freeze({
    message: 'All eligible classification capacity is in use. This task remains queued until a worker slot opens.',
  }),
  ai_unavailable: Object.freeze({
    message: 'The worker is running, but AI is currently unavailable. Queued classification resumes when provider availability is confirmed.',
  }),
  dispatch_check_failed: Object.freeze({
    message: 'Classifarr could not verify classification worker state. Refresh the Command Center for a new snapshot.',
  }),
})

const workerStatusId = computed(() => {
  const statusId = props.diagnostics?.queue?.statusId
  return Object.hasOwn(WORKER_PRESENTATIONS, statusId) ? statusId : null
})

const workerPresentation = computed(() => (
  workerStatusId.value ? WORKER_PRESENTATIONS[workerStatusId.value] : null
))

const strictVerificationModelChanged = computed(() => (
  props.diagnostics?.strictVerification?.statusId === 'model_changed'
))

const hasPresentation = computed(() => (
  Boolean(workerPresentation.value) || strictVerificationModelChanged.value
))
</script>

<style scoped>
.queue-admission-diagnostics {
  display: grid;
  gap: 0.625rem;
  border-left: 3px solid #f59e0b;
  border-radius: 0.375rem;
  background: rgba(120, 53, 15, 0.16);
  padding: 0.75rem;
}

.queue-admission-diagnostics-label {
  margin: 0;
  color: #fbbf24;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.queue-admission-diagnostics-message {
  margin: 0.25rem 0 0;
  color: #fde68a;
  font-size: 0.85rem;
  line-height: 1.45;
}

.queue-admission-diagnostics-action {
  margin-top: 0.5rem;
  border: 0;
  border-radius: 0.375rem;
  background: #d97706;
  color: #fff;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.45rem 0.625rem;
}

.queue-admission-diagnostics-action:hover,
.queue-admission-diagnostics-action:focus-visible {
  background: #b45309;
}
</style>
