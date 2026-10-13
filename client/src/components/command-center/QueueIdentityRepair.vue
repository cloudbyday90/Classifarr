<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="identity-repair">
    <p v-if="task.payload?.identity_repair || receipt">
      This task has a reviewed ID repair. Retry All does not include it.
    </p>
    <Button
      v-if="canPreview && !receipt && !task.payload?.identity_repair"
      variant="secondary"
      size="sm"
      :disabled="Boolean(busy)"
      @click="review"
    >
      Review replacement ID
    </Button>
    <Button
      variant="secondary"
      size="sm"
      :disabled="Boolean(busy)"
      @click="readReceipt"
    >
      Check saved repair
    </Button>
    <p
      v-if="busy"
      role="status"
    >
      {{ busy === 'receipt' ? 'Checking saved outcome…' : busy === 'retry' ? 'Requesting the reviewed retry…' : 'Rechecking identity evidence…' }}
    </p>
    <p
      v-if="message"
      role="status"
    >
      {{ message }}
    </p>
    <p
      v-if="error"
      role="alert"
    >
      {{ error }}
    </p>
    <form
      v-if="preview && !receipt"
      @submit.prevent="confirm"
    >
      <p>
        Replace TMDb {{ preview.mediaType === 'movie' ? 'movie' : 'TV series' }} ID
        {{ preview.oldTmdbId }} with {{ preview.candidate.tmdbId }}?
      </p>
      <p>{{ preview.candidate.title }} · {{ preview.candidate.releaseDate || 'Date unavailable' }}</p>
      <p v-if="preview.candidate.overview">
        {{ preview.candidate.overview }}
      </p>
      <p>All supported TMDb IDs in this task will change together. The original webhook and attempt count stay unchanged. Classification will not run yet.</p>
      <label>
        <input
          v-model="confirmed"
          type="checkbox"
          :disabled="Boolean(busy)"
        >
        I verified that this is the same work and edition as the original request.
      </label>
      <Button
        type="submit"
        variant="warning"
        size="sm"
        :disabled="Boolean(busy) || !confirmed"
      >
        Save reviewed replacement
      </Button>
    </form>
    <div
      v-if="receipt"
      role="status"
    >
      <p>Saved repair: TMDb {{ receipt.oldTmdbId }} → {{ receipt.newTmdbId }} ({{ receipt.mediaType }}).</p>
      <p>Reference: {{ receipt.id }} · Saved {{ receipt.confirmedAt }}</p>
      <p v-if="receipt.retriedAt">
        Retry was queued at {{ receipt.retriedAt }}. This is a saved action, not proof classification finished.
      </p>
      <template v-else>
        <p>Nothing has been retried. The next action can classify and route this request using the reviewed ID.</p>
        <Button
          variant="warning"
          size="sm"
          :disabled="Boolean(busy)"
          @click="retry"
        >
          Retry using reviewed ID
        </Button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { Button } from '@/components/common'
import { getQueueIdentityRepair, previewQueueIdentityRepair, confirmQueueIdentityRepair,
  retryQueueIdentityRepair } from '@/api/queueTasksApi'
import { queueIdentityRepairError } from '@/utils/queueIdentityRepairPresentation'

const props = defineProps({ task: { type: Object, required: true }, canPreview: Boolean })
const busy = ref('')
const preview = ref(null)
const receipt = ref(null)
const confirmed = ref(false)
const message = ref('')
const error = ref('')
let generation = 0
let controller = null

function reset() {
  generation += 1
  controller?.abort()
  controller = null
  busy.value = ''; preview.value = null; receipt.value = null
  confirmed.value = false; message.value = ''; error.value = ''
}
watch(() => JSON.stringify([props.task.id, props.task.status, props.task.attempts,
  props.task.payload, props.task.error_message]), reset)
onBeforeUnmount(reset)

async function run(action, operation, accept) {
  if (busy.value) return
  const ticket = ++generation
  controller = new AbortController()
  busy.value = action; error.value = ''; message.value = ''
  try {
    const result = await operation({ signal: controller.signal })
    if (ticket === generation) accept(result)
  } catch (failure) {
    if (ticket !== generation) return
    preview.value = null; confirmed.value = false
    error.value = queueIdentityRepairError(action, failure.response?.status, failure.response?.data?.code)
  } finally {
    if (ticket === generation) { busy.value = ''; controller = null }
  }
}
function review() {
  confirmed.value = false; preview.value = null
  return run('preview', options => previewQueueIdentityRepair(props.task.id, options), response => { preview.value = response.data })
}
function readReceipt() {
  return run('receipt', options => getQueueIdentityRepair(props.task.id, options), data => {
    receipt.value = data.receipt
    if (data.receipt) { preview.value = null; confirmed.value = false }
    else message.value = 'No saved repair was observed. If an action was interrupted, check again before starting a new review.'
  })
}
function confirm() {
  if (!confirmed.value || !preview.value) return
  return run('confirm', options => confirmQueueIdentityRepair(props.task.id,
    { previewId: preview.value.previewId, sameWorkAndEdition: true }, options), response => {
    receipt.value = response.data.receipt; preview.value = null; confirmed.value = false
  })
}
function retry() {
  if (!receipt.value || receipt.value.retriedAt) return
  return run('retry', options => retryQueueIdentityRepair(props.task.id,
    { receiptId: receipt.value.id }, options), response => { receipt.value = response.data.receipt })
}
</script>

<style scoped>
.identity-repair { margin-top: 0.75rem; }
p, label { display: block; margin-top: 0.5rem; overflow-wrap: anywhere; }
button { margin: 0.5rem 0.5rem 0 0; }
</style>
