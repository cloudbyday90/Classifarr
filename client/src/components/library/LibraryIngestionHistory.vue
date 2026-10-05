<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <details
    :open="opened"
    class="border border-gray-600 rounded-lg p-4 space-y-3"
    @toggle="setOpened($event.target.open)"
  >
    <summary class="cursor-pointer font-semibold">
      Recovery history
    </summary>
    <template v-if="opened">
      <p class="text-sm text-gray-300">
        Automatic recovery and your requests, with verified progress. Optional AI work is separate.
      </p>
      <Button
        :disabled="loading"
        @click="refresh"
      >
        Refresh history
      </Button>
      <p
        v-if="loading"
        role="status"
      >
        Loading recovery history…
      </p>
      <p
        v-if="error"
        role="alert"
      >
        {{ error }}
      </p>
      <template v-if="history">
        <p role="status">
          {{ history.receipts.length ? `Recorded recoveries: ${history.receipts.length}.` : 'No retained recovery receipts found.' }}
          <span v-if="history.receipts.length">Latest: {{ recoveryProgressView(history.receipts[0].progress).label }}.</span>
        </p>
        <p
          v-if="history.hasMore"
          class="text-sm text-gray-300"
        >
          Showing the newest {{ history.limit }} retained receipts.
        </p>
        <ul
          v-if="history.receipts.length"
          aria-label="Recorded recoveries"
          class="space-y-3"
        >
          <li
            v-for="receipt in history.receipts"
            :key="receipt.auditId"
            class="text-sm space-y-1"
          >
            <p class="font-medium">
              Receipt #{{ receipt.auditId }} — {{ receipt.replay === 'scheduled' ? 'Full import requested' : 'Library was left disabled' }}
            </p>
            <p v-if="receipt.automatic">
              Started automatically after blocking pre-upgrade writers.
            </p>
            <time :datetime="receipt.confirmedAt">{{ receipt.confirmedAt }}</time>
            <p class="break-all">
              Request: <code>{{ receipt.requestId }}</code>
            </p>
            <IngestionRecoveryProgress :progress="receipt.progress" />
          </li>
        </ul>
        <p class="text-sm text-gray-300">
          A receipt records the recovery handoff, not a finished import. History follows audit retention; missing receipts do not prove a request failed.
        </p>
      </template>
    </template>
  </details>
</template>

<script setup>
import { toRef } from 'vue'
import Button from '@/components/common/Button.vue'
import IngestionRecoveryProgress from './IngestionRecoveryProgress.vue'
import { recoveryProgressView } from '@/utils/ingestionRecoveryProgress'
import { useIngestionRecoveryHistory } from '@/composables/useIngestionRecoveryHistory'
const props = defineProps({ libraryId: { type: Number, required: true } })
const { opened, loading, history, error, refresh, setOpened } = useIngestionRecoveryHistory(toRef(props, 'libraryId'))
</script>
