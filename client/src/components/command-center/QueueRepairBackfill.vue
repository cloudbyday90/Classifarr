<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <details class="repair-backfill">
    <summary>Retry reviewed repairs</summary>
    <p>Select up to five previously approved repairs. This can classify and route the selected requests; it does not approve other items.</p>
    <Button
      size="sm"
      variant="secondary"
      :disabled="busy || uncertain"
      @click="load()"
    >
      Load reviewed repairs
    </Button>
    <p
      v-if="busy"
      role="status"
    >
      Working…
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
      v-if="items.length"
      @submit.prevent="submit"
    >
      <fieldset :disabled="busy || uncertain">
        <legend>Choose repairs to retry</legend>
        <label
          v-for="item in items"
          :key="item.receiptId"
        >
          <input
            v-model="selected"
            type="checkbox"
            :value="item.receiptId"
            :disabled="selected.length >= 5 && !selected.includes(item.receiptId)"
          >
          Task #{{ item.taskId }} · {{ item.title }} · {{ item.mediaType }}
          TMDb {{ item.oldTmdbId }} → {{ item.newTmdbId }}
        </label>
        <label>
          <input
            v-model="confirmed"
            type="checkbox"
          >
          Retry only these selected repairs using their existing attempt budgets.
        </label>
        <Button
          type="submit"
          size="sm"
          variant="warning"
          :disabled="!confirmed || !selected.length"
        >
          Retry {{ selected.length }} selected repairs
        </Button>
        <Button
          v-if="nextCursor"
          size="sm"
          variant="secondary"
          @click="load(nextCursor)"
        >
          Next page
        </Button>
      </fieldset>
    </form>
    <Button
      v-if="uncertain"
      size="sm"
      variant="secondary"
      :disabled="busy"
      @click="check"
    >
      Check saved retry outcomes
    </Button>
  </details>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { Button } from '@/components/common'
import { getQueueRepairBackfill, retryQueueRepairBackfill, getQueueIdentityRepair } from '@/api/queueTasksApi'

const items = ref([])
const selected = ref([])
const confirmed = ref(false)
const nextCursor = ref(null)
const busy = ref(false)
const uncertain = ref(false)
const message = ref('')
const error = ref('')
let submitted = []
let generation = 0
let controller
watch(selected, () => { confirmed.value = false })
onBeforeUnmount(() => { generation++; controller?.abort() })

async function perform(action, operation, accept) {
  if (busy.value) return
  const ticket = ++generation
  controller = new AbortController()
  busy.value = true; error.value = ''; message.value = ''
  try {
    const result = await operation({ signal: controller.signal })
    if (ticket === generation) accept(result)
  } catch (failure) {
    if (ticket !== generation) return
    const rejected = [400, 401, 403, 404, 409, 429].includes(failure.response?.status)
    if (action === 'retry') uncertain.value = !rejected
    error.value = action === 'load'
      ? 'Could not load reviewed repairs. Check administrator access and try again.'
      : action === 'retry' && rejected
        ? 'No new retries were queued. Reload and review the selected tasks individually; access, settings, task state or retry limits may have changed. Earlier saved retries remain unchanged.'
      : 'The retry outcome is not confirmed. Check saved outcomes before retrying. Changed tasks or settings may require individual review.'
  } finally { if (ticket === generation) busy.value = false }
}
function load(afterId) {
  if (busy.value || uncertain.value) return
  selected.value = []; confirmed.value = false; items.value = []; nextCursor.value = null
  return perform('load', options => getQueueRepairBackfill({ ...options, afterId }), data => {
    items.value = data.items; nextCursor.value = data.nextCursor
    message.value = data.items.length ? 'Safety checks run again when you retry. One changed item blocks the whole selection.' : 'No reviewed repairs awaiting retry on this page.'
  })
}
function submit() {
  if (busy.value || uncertain.value || !confirmed.value || !selected.value.length || selected.value.length > 5) return
  submitted = items.value.filter(item => selected.value.includes(item.receiptId))
    .map(({ taskId, receiptId }) => ({ taskId, receiptId }))
  return perform('retry', options => retryQueueRepairBackfill({ items: submitted, confirmRetry: true }, options), response => {
    message.value = `${response.data.receipts.length} saved retry outcomes. Queued does not mean classification finished.`
    items.value = []; selected.value = []; confirmed.value = false; nextCursor.value = null
  })
}
function check() {
  return perform('check', async options => {
    const receipts = []
    for (const item of submitted) receipts.push((await getQueueIdentityRepair(item.taskId, options)).receipt)
    return receipts
  }, receipts => {
    const retried = receipts.filter((receipt, index) => receipt?.id === submitted[index].receiptId && receipt.retriedAt).length
    message.value = `${retried} of ${submitted.length} saved retries observed. This does not prove classification finished. A missing outcome may still be in flight; check again before further action.`
    if (retried === submitted.length) {
      uncertain.value = false; items.value = []; selected.value = []; confirmed.value = false; nextCursor.value = null
    }
  })
}
</script>

<style scoped>
.repair-backfill { margin: 0.75rem 0; }
summary { cursor: pointer; }
p, label { display: block; margin: 0.5rem 0; overflow-wrap: anywhere; }
button { margin: 0.5rem 0.5rem 0 0; }
</style>
