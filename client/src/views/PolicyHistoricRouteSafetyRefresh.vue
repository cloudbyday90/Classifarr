<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm font-medium text-primary">
          Administrator maintenance
        </p>
        <h1 class="mt-1 text-2xl font-bold">
          Historic route-safety refresh
        </h1>
        <p class="mt-2 max-w-3xl text-sm text-gray-400">
          Review historical pending decisions that did not retain route-safety state.
          Select only the records to retry; Classifarr rechecks current server state for each one.
        </p>
      </div>
      <div class="flex flex-wrap gap-3">
        <RouterLink
          to="/policies"
          class="rounded border border-gray-600 px-4 py-2 text-sm font-medium text-gray-200 hover:border-gray-400"
        >
          Back to policies
        </RouterLink>
        <button
          type="button"
          class="rounded border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="isInventoryLoading || isExecuting"
          @click="loadInventory({ reset: true })"
        >
          {{ isInventoryLoading ? 'Refreshing...' : 'Refresh inventory' }}
        </button>
      </div>
    </div>

    <div
      v-if="actionError"
      class="rounded border border-red-500/50 bg-red-950/30 p-4 text-sm text-red-100"
      role="alert"
    >
      {{ actionError }}
    </div>
    <div
      v-if="inventoryError"
      class="rounded border border-red-500/50 bg-red-950/30 p-4 text-sm text-red-100"
      role="alert"
    >
      {{ inventoryError }}
    </div>
    <p
      v-if="actionMessage"
      class="rounded border border-primary/50 bg-primary/10 p-4 text-sm text-primary-100"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ actionMessage }}
    </p>

    <section
      class="overflow-hidden rounded-lg border border-gray-700 bg-background-light"
      aria-labelledby="historic-route-safety-inventory-heading"
    >
      <div class="flex flex-wrap items-start justify-between gap-4 border-b border-gray-700 p-5">
        <div>
          <h2
            id="historic-route-safety-inventory-heading"
            class="text-lg font-semibold"
          >
            Read-only inventory
          </h2>
          <p class="mt-1 max-w-3xl text-sm text-gray-400">
            This inventory does not retry, route, or change learning. Selection is empty by default and is limited to {{ maximumSelectionCount }} records per controlled retry.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-200 hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!records.length || isExecuting"
            @click="selectVisibleRecords"
          >
            Select shown
          </button>
          <button
            type="button"
            class="rounded border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-200 hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="selectedCount === 0 || isExecuting"
            @click="clearSelection"
          >
            Clear selection
          </button>
        </div>
      </div>

      <div
        v-if="isInventoryLoading && !inventory"
        class="p-5 text-sm text-gray-400"
        role="status"
        aria-live="polite"
      >
        Loading the bounded historical inventory...
      </div>
      <template v-else-if="inventory">
        <div
          v-if="records.length"
          class="overflow-x-auto"
        >
          <table class="min-w-full text-left text-sm">
            <caption class="sr-only">
              Historical pending decisions eligible for controlled route-safety refresh
            </caption>
            <thead class="bg-background text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th
                  scope="col"
                  class="w-14 px-5 py-3"
                >
                  <span class="sr-only">Select</span>
                </th>
                <th
                  scope="col"
                  class="px-5 py-3"
                >
                  Candidate
                </th>
                <th
                  scope="col"
                  class="px-5 py-3"
                >
                  Pending state
                </th>
                <th
                  scope="col"
                  class="px-5 py-3"
                >
                  Required action
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-800">
              <tr
                v-for="record in records"
                :key="record.classificationId"
              >
                <td class="px-5 py-3 align-top">
                  <input
                    :id="`historic-route-safety-select-${record.classificationId}`"
                    type="checkbox"
                    :checked="isSelected(record.classificationId)"
                    :disabled="isExecuting"
                    :aria-label="`Select ${candidateTitle(record)}`"
                    class="h-4 w-4 rounded border-gray-500 bg-gray-900 text-primary focus:ring-primary"
                    @change="toggleSelection(record.classificationId)"
                  >
                </td>
                <td class="px-5 py-3 align-top text-gray-100">
                  <p class="font-medium">
                    {{ candidateTitle(record) }}
                  </p>
                  <p class="mt-1 text-xs text-gray-400">
                    {{ candidateContext(record) }}
                  </p>
                </td>
                <td class="px-5 py-3 align-top text-gray-300">
                  {{ formatIdentifier(record.pendingStatus) }}
                </td>
                <td class="px-5 py-3 align-top text-gray-300">
                  Re-evaluate current policy and route-safety state
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p
          v-else
          class="p-5 text-sm text-gray-400"
        >
          No currently eligible historical route-safety refresh records were found.
        </p>

        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-700 p-4 text-sm text-gray-300">
          <span>Page {{ currentPageNumber }}. {{ selectedCount }} selected.</span>
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded border border-gray-600 px-3 py-1.5 text-sm font-medium hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!canLoadPreviousPage || isInventoryLoading || isExecuting"
              @click="loadPreviousPage"
            >
              Previous
            </button>
            <button
              type="button"
              class="rounded border border-gray-600 px-3 py-1.5 text-sm font-medium hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!canLoadNextPage || isInventoryLoading || isExecuting"
              @click="loadNextPage"
            >
              Next
            </button>
          </div>
        </div>
      </template>
    </section>

    <section
      class="rounded-lg border border-amber-700/50 bg-amber-950/10 p-5"
      aria-labelledby="historic-route-safety-execution-heading"
    >
      <h2
        id="historic-route-safety-execution-heading"
        class="text-lg font-semibold"
      >
        Controlled retry
      </h2>
      <p class="mt-1 max-w-3xl text-sm text-gray-300">
        This command runs only for your explicit selection. Each record is locked and checked against current server state before work is queued; ineligible and duplicate records are retained in the receipt instead of retried.
      </p>
      <label class="mt-4 flex max-w-3xl items-start gap-3 text-sm text-gray-200">
        <input
          id="historic-route-safety-execution-acknowledgement"
          v-model="executionAcknowledged"
          type="checkbox"
          :disabled="selectedCount === 0 || isExecuting"
          class="mt-0.5 h-4 w-4 rounded border-gray-500 bg-gray-900 text-primary focus:ring-primary"
        >
        <span>I reviewed the selected records and understand that this re-evaluates their current classification state.</span>
      </label>
      <p
        v-if="selectionMessage"
        class="mt-3 text-sm text-amber-200"
        role="status"
        aria-live="polite"
      >
        {{ selectionMessage }}
      </p>
      <button
        type="button"
        class="mt-4 rounded bg-warning px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="selectedCount === 0 || !executionAcknowledged || isExecuting"
        :aria-busy="isExecuting"
        @click="executeSelected"
      >
        {{ isExecuting ? 'Starting controlled retry...' : `Retry ${selectedCount} selected record${selectedCount === 1 ? '' : 's'}` }}
      </button>
    </section>

    <section
      v-if="receipt || receiptError"
      class="overflow-hidden rounded-lg border border-primary/60 bg-primary/10"
      aria-labelledby="historic-route-safety-receipt-heading"
    >
      <div class="flex flex-wrap items-start justify-between gap-4 border-b border-primary/40 p-5">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-primary-100">
            Protected receipt
          </p>
          <h2
            id="historic-route-safety-receipt-heading"
            class="mt-1 text-lg font-semibold text-white"
          >
            Latest controlled retry status
          </h2>
          <p
            v-if="receipt"
            class="mt-1 text-sm text-gray-300"
          >
            {{ receiptStatusMessage }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded border border-primary px-3 py-1.5 text-sm font-medium text-primary-100 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="isReceiptLoading"
            @click="loadReceipt"
          >
            {{ isReceiptLoading ? 'Refreshing...' : 'Refresh status' }}
          </button>
          <button
            type="button"
            class="rounded border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-200 hover:border-gray-400"
            @click="clearReceipt"
          >
            Clear receipt view
          </button>
        </div>
      </div>

      <div
        v-if="receiptError"
        class="m-5 rounded border border-red-500/50 bg-red-950/30 p-4 text-sm text-red-100"
        role="alert"
      >
        {{ receiptError }}
      </div>
      <template v-else-if="receipt">
        <p
          class="border-b border-primary/30 px-5 py-3 text-sm text-primary-100"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          :aria-busy="isReceiptLoading || isReceiptInFlight"
        >
          {{ receiptStatusMessage }}
        </p>
        <dl class="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt class="text-xs uppercase tracking-wide text-gray-400">
              Submitted
            </dt>
            <dd class="mt-1 text-sm font-semibold text-white">
              {{ formatHistoricRouteSafetyRefreshTimestamp(receipt.receipt?.createdAt) }}
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-gray-400">
              Queued
            </dt>
            <dd class="mt-1 text-sm font-semibold text-white">
              {{ receipt.summary?.queued ?? 0 }}
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-gray-400">
              Not queued
            </dt>
            <dd class="mt-1 text-sm font-semibold text-white">
              {{ receipt.summary?.skipped ?? 0 }}
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-gray-400">
              Runtime final
            </dt>
            <dd class="mt-1 text-sm font-semibold text-white">
              {{ receipt.summary?.runtimeFinal ?? 0 }}
            </dd>
          </div>
        </dl>

        <div class="overflow-x-auto border-t border-primary/30">
          <table class="min-w-full text-left text-sm">
            <caption class="sr-only">
              Current lifecycle states for the selected historic route-safety refresh records
            </caption>
            <thead class="bg-background/70 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th
                  scope="col"
                  class="px-5 py-3"
                >
                  Selected record
                </th>
                <th
                  scope="col"
                  class="px-5 py-3"
                >
                  Command outcome
                </th>
                <th
                  scope="col"
                  class="px-5 py-3"
                >
                  Current runtime outcome
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-primary/20">
              <tr
                v-for="record in receipt.records"
                :key="record.classificationId"
              >
                <td class="px-5 py-3 font-medium text-white">
                  {{ record.classificationId }}
                </td>
                <td class="px-5 py-3">
                  <span
                    class="rounded-full border px-2 py-1 text-xs font-medium"
                    :class="toneClass(executionPresentation(record.executionStatusId).tone)"
                  >
                    {{ executionPresentation(record.executionStatusId).label }}
                  </span>
                </td>
                <td class="px-5 py-3">
                  <p class="font-medium text-white">
                    {{ statusPresentation(record.reconciliationStatusId).label }}
                  </p>
                  <p class="mt-1 text-xs text-gray-400">
                    {{ statusPresentation(record.reconciliationStatusId).description }}
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'

import { useHistoricRouteSafetyRefreshMaintenance } from '@/composables/useHistoricRouteSafetyRefreshMaintenance'
import {
  formatHistoricRouteSafetyRefreshTimestamp,
  historicRouteSafetyRefreshExecutionPresentation,
  historicRouteSafetyRefreshStatusPresentation,
} from '@/utils/historicRouteSafetyRefreshPresentation'

const executionAcknowledged = ref(false)
const {
  actionError,
  actionMessage,
  canLoadNextPage,
  canLoadPreviousPage,
  clearReceipt,
  clearSelection,
  currentPageNumber,
  executeSelected,
  inventory,
  inventoryError,
  isExecuting,
  isInventoryLoading,
  isReceiptInFlight,
  isReceiptLoading,
  isSelected,
  loadInventory,
  loadNextPage,
  loadPreviousPage,
  loadReceipt,
  maximumSelectionCount,
  receipt,
  receiptError,
  records,
  selectVisibleRecords,
  selectedCount,
  selectionMessage,
  toggleSelection,
} = useHistoricRouteSafetyRefreshMaintenance()

const receiptStatusMessage = computed(() => {
  if (!receipt.value) return 'Receipt status is unavailable.'
  if (isReceiptInFlight.value) {
    return 'Classifarr is checking the current runtime outcome while queued work remains. Polling pauses when this tab is hidden.'
  }
  return 'The receipt has reached a stable observed runtime outcome. Refresh manually if current server activity changes it.'
})

watch(selectedCount, () => {
  executionAcknowledged.value = false
})

function candidateTitle(record) {
  return record?.candidateItem?.title || `Classification ${record?.classificationId || 'unknown'}`
}

function candidateContext(record) {
  const candidate = record?.candidateItem || {}
  const fields = [candidate.year, candidate.media_type && formatIdentifier(candidate.media_type)].filter(Boolean)
  return fields.length ? fields.join(' | ') : 'Historical pending classification'
}

function formatIdentifier(value) {
  return typeof value === 'string' && value.trim()
    ? value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase())
    : 'Unavailable'
}

function executionPresentation(statusId) {
  return historicRouteSafetyRefreshExecutionPresentation(statusId)
}

function statusPresentation(statusId) {
  return historicRouteSafetyRefreshStatusPresentation(statusId)
}

function toneClass(tone) {
  return {
    success: 'border-green-500/60 bg-green-950/30 text-green-100',
    info: 'border-primary/60 bg-primary/10 text-primary-100',
    warning: 'border-amber-500/60 bg-amber-950/30 text-amber-100',
    error: 'border-red-500/60 bg-red-950/30 text-red-100',
    neutral: 'border-gray-600 bg-gray-800 text-gray-200',
  }[tone] || 'border-gray-600 bg-gray-800 text-gray-200'
}

onMounted(() => {
  loadInventory({ reset: true })
})
</script>
