<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    class="space-y-4"
    aria-labelledby="verification-capability-receipts-heading"
  >
    <div
      class="space-y-2"
      role="status"
      aria-atomic="true"
      :aria-busy="loading"
    >
      <p class="text-xs font-medium uppercase tracking-wide text-blue-200">
        Your recent capability changes
      </p>
      <h3
        id="verification-capability-receipts-heading"
        class="font-medium text-gray-100"
      >
        Verification capability receipts
      </h3>
      <p class="text-sm text-gray-400">
        Receipts record a saved capability transition only. They do not retain provider settings or classification data.
      </p>
    </div>

    <p
      v-if="receipts.length === 0"
      class="text-sm text-gray-400"
    >
      No strict-verification capability changes have been recorded from your saved AI settings.
    </p>

    <ol
      v-else
      class="space-y-3"
    >
      <li
        v-for="receipt in receipts"
        :key="receipt.receiptId"
        class="rounded-lg border border-gray-700 bg-gray-800/50 p-3"
      >
        <p class="text-sm font-medium text-gray-100">
          {{ receipt.before.label }} to {{ receipt.after.label }}
        </p>
        <p class="mt-1 text-xs text-gray-400">
          Saved revision {{ receipt.configurationRevision }} at
          <time :datetime="receipt.recordedAt">{{ receipt.recordedAt }}</time>
        </p>
      </li>
    </ol>

    <Button
      variant="secondary"
      :disabled="loading"
      @click="emit('refresh')"
    >
      <span v-if="loading">Refreshing...</span>
      <span v-else>Refresh Receipts</span>
    </Button>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import Button from '@/components/common/Button.vue'

const props = defineProps({
  report: {
    type: Object,
    default: () => null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['refresh'])

function normalizeReceipt(receipt) {
  const beforeLabel = typeof receipt?.before?.label === 'string'
    ? receipt.before.label
    : 'Earlier verification state unavailable'
  const afterLabel = typeof receipt?.after?.label === 'string'
    ? receipt.after.label
    : 'Current verification state unavailable'

  return {
    receiptId: typeof receipt?.receiptId === 'string' ? receipt.receiptId : beforeLabel + afterLabel,
    before: { label: beforeLabel },
    after: { label: afterLabel },
    configurationRevision: typeof receipt?.configurationRevision === 'string'
      ? receipt.configurationRevision
      : 'unknown',
    recordedAt: typeof receipt?.recordedAt === 'string'
      ? receipt.recordedAt
      : 'an unknown time',
  }
}

const receipts = computed(() => Array.isArray(props.report?.receipts)
  ? props.report.receipts.slice(0, 5).map(normalizeReceipt)
  : [])
</script>
