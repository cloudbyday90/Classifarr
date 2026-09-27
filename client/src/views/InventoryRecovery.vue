<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="space-y-5">
    <RouterLink
      to="/libraries"
      class="text-blue-300 underline"
    >
      Back to Libraries
    </RouterLink>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold">
        Metadata recovery
      </h1>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          :aria-pressed="paused"
          class="recovery-button"
          @click="togglePause"
        >
          {{ paused ? 'Resume updates' : 'Pause updates' }}
        </button>
        <button
          type="button"
          :disabled="busy"
          class="recovery-button"
          @click="refresh"
        >
          Refresh cases
        </button>
      </div>
    </div>
    <p class="max-w-3xl text-gray-300">
      See why metadata is missing and what happens next. Identity and routing stay unchanged.
    </p>
    <p
      role="status"
      class="text-sm text-gray-300"
    >
      {{ error ? 'Recovery data is unavailable. An active administrator session is required; refresh to try again.' : !report ? 'Loading recovery cases…' : paused ? 'Display updates paused. Background recovery continues.' : 'Updates every 30 seconds while this tab is visible.' }}
    </p>
    <template v-if="report">
      <InventoryRecoveryProgress :report="report.progress" />
      <dl
        class="grid grid-cols-3 gap-3"
        aria-label="Recorded open recovery cases"
      >
        <div
          v-for="card in cards"
          :key="card.label"
          class="rounded-xl border border-gray-600 bg-gray-800 p-3 sm:p-5"
        >
          <dt class="text-sm text-gray-300">
            {{ card.label }}
          </dt>
          <dd class="mt-1 text-3xl font-bold tabular-nums">
            {{ card.count }}
          </dd>
        </div>
      </dl>
      <p class="text-sm text-gray-300">
        Recorded open cases in active movie/TV libraries, not all missing metadata. As of {{ recoveryDate(report.asOf) }}.
      </p>
      <p
        v-if="!report.total"
        class="rounded-xl border border-gray-600 p-5"
      >
        No open recovery cases recorded. Items not yet checked are not included.
      </p>
      <p v-else-if="!report.items.length">
        No cases remain on this page. Go back to see earlier items.
      </p>
      <ul
        class="space-y-4"
        aria-label="Metadata recovery cases"
      >
        <InventoryRecoveryItem
          v-for="item in report.items"
          :key="`${item.id}:${item.caseId}`"
          :item="item"
        />
      </ul>
    </template>
    <nav
      class="flex flex-wrap gap-3"
      aria-label="Recovery pages"
    >
      <button
        v-if="previousPages.length"
        type="button"
        :disabled="busy"
        class="recovery-button"
        @click="previousPage"
      >
        Previous page
      </button>
      <button
        v-if="report?.nextCursor"
        type="button"
        :disabled="busy"
        class="recovery-button"
        @click="nextPage"
      >
        Next page
      </button>
    </nav>
    <p class="text-sm text-gray-300">
      Retry times show when a check becomes eligible, not a guaranteed start time.
    </p>
    <RouterLink
      to="/libraries/identity-review"
      class="inline-block text-blue-300 underline"
    >
      Review items without a media ID
    </RouterLink>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import InventoryRecoveryItem from '@/components/library/InventoryRecoveryItem.vue'
import InventoryRecoveryProgress from '@/components/library/InventoryRecoveryProgress.vue'
import { useInventoryRecovery } from '@/composables/useInventoryRecovery'
import { recoveryDate } from '@/utils/inventoryRecovery'
const { report, previousPages, paused, busy, error, refresh, togglePause, nextPage, previousPage } = useInventoryRecovery()
const cards = computed(() => [
  { label: 'Open cases', count: report.value?.total }, { label: 'Movies', count: report.value?.movies },
  { label: 'TV shows', count: report.value?.tv },
])
</script>
<style scoped>
.recovery-button { border: 1px solid #6b7280; border-radius: 0.375rem; padding: 0.5rem 0.75rem; }
.recovery-button:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
.recovery-button:disabled { opacity: 0.5; }
</style>
