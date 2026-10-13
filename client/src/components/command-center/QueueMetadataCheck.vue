<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="metadata-check">
    <p v-if="!task.payload?.identity_repair && task.metadata_recovery?.recoveredAt">
      Automatic recovery was already used for this task. Further retries need review.
    </p>
    <p v-else-if="!task.payload?.identity_repair && task.metadata_recovery && legacyIdentity">
      Automatic checks are paused for this legacy request format. Use Check saved TMDb ID
      to inspect it; repairing this format needs a separate review. Nothing has been remapped.
    </p>
    <p v-else-if="!task.payload?.identity_repair && task.metadata_recovery?.checks >= 6">
      Automatic record checks are exhausted. Review the saved ID; it has not been replaced.
    </p>
    <p v-else-if="!task.payload?.identity_repair && task.metadata_recovery?.nextCheckAt">
      Automatic record check: {{ formatCheckTime(task.metadata_recovery.nextCheckAt) }}.
      If the same ID returns, Classifarr can resume this task once without resetting its attempts.
    </p>
    <Button
      v-if="!task.payload?.identity_repair"
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
      <QueueIdentityEvidence
        v-if="report.identityEvidence"
        :evidence="report.identityEvidence"
      />
      <details>
        <summary>Check details for support</summary>
        <p>Task #{{ report.taskId }} · Checked {{ report.checkedAt }}</p>
        <p>Saved failure: {{ report.savedFailure }}</p>
        <p>Current check: {{ report.observation?.category }} · HTTP {{ report.observation?.httpStatus ?? 'unavailable' }}</p>
        <p v-if="report.observation?.transportCode">
          Connection code: {{ report.observation.transportCode }}
        </p>
        <template v-if="report.identityEvidence">
          <p>External-ID check: {{ report.identityEvidence.reason }}</p>
          <p v-if="report.identityEvidence.observation">
            Provider: {{ report.identityEvidence.observation.category }} · HTTP {{ report.identityEvidence.observation.httpStatus ?? 'unavailable' }}
            <span v-if="report.identityEvidence.observation.transportCode"> · {{ report.identityEvidence.observation.transportCode }}</span>
          </p>
        </template>
        <p>This check does not establish why a record disappeared or approve a replacement.</p>
      </details>
    </div>
    <QueueIdentityRepair
      :task="task"
      :can-preview="report?.identityEvidence?.reason === 'candidate_for_review'"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Button } from '@/components/common'
import QueueIdentityEvidence from './QueueIdentityEvidence.vue'
import QueueIdentityRepair from './QueueIdentityRepair.vue'
import { checkQueueTaskMetadata } from '@/api/queueTasksApi'
import { queueMetadataCheckError, queueMetadataCheckMessage } from '@/utils/queueMetadataCheckPresentation'

const props = defineProps({ task: { type: Object, required: true } })
const legacyIdentity = computed(() => ['media', 'extra', 'tmdbId', 'mediaType']
  .some(key => Object.hasOwn(props.task.payload ?? {}, key)))
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
    if (ticket === generation) error.value = queueMetadataCheckError(failure.response?.status, failure.response?.data?.code)
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
