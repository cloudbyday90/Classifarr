<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    class="border border-gray-600 rounded-lg p-4 space-y-3"
    aria-label="Interrupted metadata recovery"
  >
    <h3 class="font-semibold">
      Recover interrupted metadata lookups
    </h3>
    <p class="text-sm text-gray-300">
      Review older retries with no recorded worker. Existing metadata stays intact.
    </p>
    <Button
      :disabled="busy || reading || !!pending"
      @click="refresh"
    >
      {{ opened ? 'Refresh retry review' : 'Review interrupted lookups' }}
    </Button>
    <p
      v-if="reading"
      role="status"
    >
      Loading review…
    </p>
    <p
      v-if="error"
      role="alert"
    >
      {{ error }}
    </p>
    <template v-if="preview && !receipt">
      <p role="status">
        {{ explanation }}
      </p>
      <template v-if="preview.canRecover">
        <p class="text-sm">
          {{ queued }} to requeue · {{ exhausted }} at their attempt limit. {{ preview.hasMore ? 'More records remain for a separate review.' : '' }}
        </p>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <caption class="text-left font-medium mb-2">
              Exact batch to recover
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  Title
                </th><th scope="col">
                  Lookup
                </th><th scope="col">
                  Attempts
                </th><th scope="col">
                  After recovery
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in preview.items"
                :key="item.id"
              >
                <th
                  scope="row"
                  class="py-2 font-normal"
                >
                  {{ item.title }} {{ item.year ? `(${item.year})` : '' }} — #{{ item.id }}
                </th>
                <td>{{ providers[item.provider] }}</td><td>{{ item.attempts }}/{{ item.maxAttempts }}</td>
                <td>{{ item.outcome === 'pending' ? 'Queued' : 'Attempt limit reached' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-sm">
          Stop older Classifarr instances and external metadata writers first. Age alone cannot prove they stopped.
        </p>
        <label class="flex items-start gap-2">
          <input
            v-model="acknowledged"
            type="checkbox"
            class="mt-1"
            :disabled="busy || reading || !!pending"
          >
          <span>I verified that older instances and external writers for this library have stopped and will remain stopped during recovery.</span>
        </label>
        <Button
          v-if="!pending"
          :disabled="!canConfirm"
          @click="confirm"
        >
          Recover reviewed lookups
        </Button>
      </template>
    </template>
    <Button
      v-if="pending"
      :disabled="busy"
      variant="secondary"
      @click="checkOutcome"
    >
      Check recorded outcome
    </Button>
    <Button
      v-if="pending"
      :disabled="!canConfirm"
      @click="confirm"
    >
      Retry same confirmation
    </Button>
    <div
      v-if="receipt"
      role="status"
    >
      <p>{{ receipt.queued }} queued · {{ receipt.exhausted }} at their attempt limit. Receipt #{{ receipt.auditId }}.</p>
      <p class="text-sm">
        Recovery is recorded, not finished. Normal library settings, provider availability and quotas still apply.
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed, toRef } from 'vue'
import Button from '@/components/common/Button.vue'
import { useLegacyEnrichmentRetryReview } from '@/composables/useLegacyEnrichmentRetryReview'
const props = defineProps({ libraryId: { type: Number, required: true } })
const { opened, preview, acknowledged, receipt, busy, reading, error, pending, canConfirm, refresh, confirm, checkOutcome } =
  useLegacyEnrichmentRetryReview(toRef(props, 'libraryId'))
const queued = computed(() => preview.value?.items.filter(item => item.outcome === 'pending').length ?? 0)
const exhausted = computed(() => (preview.value?.items.length ?? 0) - queued.value)
const providers = { omdb: 'OMDb', web_search: 'Web search', tavily: 'Tavily' }
const explanations = { unsupported_library: 'Only movie and TV libraries are supported.',
  library_archived: 'Restore this library before recovering retries.', not_needed: 'No supported legacy lookups need recovery. Recorded worker claims are handled separately.' }
const explanation = computed(() => preview.value?.canRecover
  ? preview.value.library.enabled ? 'Review these lookups before restarting them.' : 'This library is disabled. Requeued work waits until you enable it.'
  : explanations[preview.value?.reason] ?? 'Review unavailable; no records will be changed.')
</script>
