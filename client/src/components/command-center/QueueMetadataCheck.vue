<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="metadata-check">
    <p v-if="task.metadata_recovery?.recoveredAt">
      Automatic recovery was already used for this task. Further retries need review.
    </p>
    <p v-else-if="task.metadata_recovery?.checks >= 6">
      Automatic record checks are exhausted. Review the saved ID; it has not been replaced.
    </p>
    <p v-else-if="task.metadata_recovery?.nextCheckAt">
      Automatic record check: {{ formatCheckTime(task.metadata_recovery.nextCheckAt) }}.
      If the same ID returns, Classifarr can resume this task once without resetting its attempts.
    </p>
    <Button
      variant="secondary"
      size="sm"
      :disabled="busy"
      :loading="busy"
      @click="check"
    >
      Check saved TMDb ID
    </Button>
    <p
      v-if="busy"
      role="status"
    >
      Checking TMDb only — classification will not run.
    </p>
    <p
      v-if="error"
      role="alert"
    >
      {{ error }}
    </p>
    <div
      v-if="report"
      role="status"
    >
      <p>TMDb {{ report.mediaType === 'movie' ? 'movie' : 'TV series' }} ID: {{ report.tmdbId }}</p>
      <p>{{ queueMetadataCheckMessage(report.observation?.category) }}</p>
      <p v-if="report.candidate">
        Current record: {{ report.candidate.title }}<span v-if="report.candidate.releaseDate"> ({{ report.candidate.releaseDate }})</span>
      </p>
      <details>
        <summary>Check details for support</summary>
        <p>Task #{{ report.taskId }} · Checked {{ report.checkedAt }}</p>
        <p>Saved failure: {{ report.savedFailure }}</p>
        <p>Current check: {{ report.observation?.category }} · HTTP {{ report.observation?.httpStatus ?? 'unavailable' }}</p>
        <p v-if="report.observation?.transportCode">
          Connection code: {{ report.observation.transportCode }}
        </p>
        <p>This check does not establish why a record disappeared or identify a replacement.</p>
      </details>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { Button } from '@/components/common'
import { checkQueueTaskMetadata } from '@/api/queueTasksApi'
import { queueMetadataCheckError, queueMetadataCheckMessage } from '@/utils/queueMetadataCheckPresentation'

const props = defineProps({ task: { type: Object, required: true } })
const busy = ref(false)
const report = ref(null)
const error = ref('')
let controller = null
let generation = 0

function formatCheckTime(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'scheduled' : date.toLocaleString()
}

function reset() {
  generation += 1
  controller?.abort()
  controller = null
  busy.value = false
  report.value = null
  error.value = ''
}

watch(() => JSON.stringify([props.task.id, props.task.status, props.task.completed_at,
  props.task.attempts, props.task.error_message, props.task.payload]), reset)
onBeforeUnmount(reset)

async function check() {
  if (busy.value) return
  reset()
  const ticket = generation
  controller = new AbortController()
  busy.value = true
  try {
    const response = await checkQueueTaskMetadata(props.task.id, { signal: controller.signal })
    if (ticket === generation) report.value = response.data
  } catch (failure) {
    if (ticket === generation) error.value = queueMetadataCheckError(failure.response?.status)
  } finally {
    if (ticket === generation) { busy.value = false; controller = null }
  }
}
</script>

<style scoped>
.metadata-check { margin-top: 0.75rem; font-size: 0.875rem; color: #d1d5db; }
.metadata-check p { margin-top: 0.5rem; overflow-wrap: anywhere; }
.metadata-check summary { margin-top: 0.5rem; cursor: pointer; }
</style>
