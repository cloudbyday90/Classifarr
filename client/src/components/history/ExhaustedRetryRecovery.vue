<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    v-if="eligible"
    class="rounded-lg border border-gray-600 bg-background p-4 space-y-3"
    aria-label="Classification retry recovery"
  >
    <h4 class="font-semibold">
      Automatic retries stopped
    </h4>
    <p class="text-sm text-gray-300">
      Repeated AI failures used up this item's automatic retries. Check that your AI
      provider and model are available, then retry classification. This starts a new
      limited set of attempts; normal routing checks still apply.
    </p>
    <Button
      :disabled="settled"
      :loading="busy"
      :aria-busy="busy"
      class="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      @click="retry"
    >
      {{ busy ? 'Queuing retry…' : 'Retry Classification' }}
    </Button>
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class="text-sm text-gray-300"
    >
      {{ message }}
    </p>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import api from '@/api'
import Button from '@/components/common/Button.vue'

const props = defineProps({ classification: { type: Object, required: true } })
const emit = defineEmits(['refresh'])
const busy = ref(false)
const settled = ref(false)
const message = ref('')
let active = true
onBeforeUnmount(() => { active = false })

// History keys this component by record ID. The POST rechecks current server state.
const eligible = computed(() => props.classification.status === 'failed' &&
  props.classification.retry_recovery?.eligible === true &&
  props.classification.retry_recovery?.reasonCode === 'retry_exhausted')

async function retry() {
  if (!eligible.value || busy.value || settled.value) return
  busy.value = true
  message.value = 'Queuing classification retry…'
  const id = props.classification.id
  try {
    const response = await api.retryClassifications([id])
    if (!active) return
    const result = response?.data?.results?.find(item => String(item.classificationId) === String(id))
    if (result?.queued === true) {
      message.value = 'Classification retry queued. Follow its progress in the Command Center.'
    } else if (result?.reasonCode === 'duplicate_pending_task') {
      message.value = 'A classification task is already queued or running for this item.'
    } else if (result?.reasonCode === 'status_ineligible' || result?.reasonCode === 'not_found') {
      message.value = 'This record has changed and was not retried. Close and reopen it to view the current state.'
    } else {
      message.value = 'The retry could not be confirmed. Check the Command Center before trying again.'
    }
  } catch (error) {
    if (!active) return
    message.value = error?.response?.status === 403
      ? 'You need write access to retry classification.'
      : 'The retry could not be confirmed. Check the Command Center before trying again.'
  } finally {
    if (active) {
      busy.value = false
      // A lost response can follow a committed enqueue. Refresh before another attempt.
      settled.value = true
      emit('refresh')
    }
  }
}
</script>
