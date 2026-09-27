<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    v-if="state !== 'complete'"
    class="border border-gray-600 rounded-lg p-4"
    aria-label="Library import"
  >
    <div role="status">
      <h3 class="font-semibold">
        {{ title }}
      </h3>
      <p class="text-sm text-gray-300 mt-1">
        {{ nextStep }}
      </p>
    </div>
    <template v-if="!unavailable && ['active', 'interrupted', 'retry_wait'].includes(state)">
      <p class="mt-3 text-sm">
        {{ count(library.ingestion_status?.items) }} items processed · {{ count(library.ingestion_status?.pages) }} pages
      </p>
      <progress
        v-if="percentage !== null"
        :value="percentage"
        max="100"
        aria-label="Reported item progress"
        class="w-full mt-2"
      />
      <p
        v-if="percentage !== null"
        class="text-xs text-gray-400"
      >
        {{ percentage }}% of reported items — final checks still required
      </p>
      <p
        v-if="retryAt && state !== 'active'"
        class="text-xs text-gray-400 mt-2"
      >
        Retry eligible after {{ retryAt }}; the scheduler starts it when capacity is available.
      </p>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { libraryIngestionState } from '@/utils/libraryIngestionStatus'
const props = defineProps({ library: { type: Object, required: true }, requesting: Boolean, unavailable: Boolean })
const state = computed(() => libraryIngestionState(props.library, props.requesting))
const copy = {
  active: ['Importing library', 'Learning waits until this import finishes. No action needed.'],
  requested: ['Import requested', 'Checking whether this library can start.'],
  interrupted: ['Import interrupted', 'Imported items are safe. Classifarr will replay the scan automatically.'],
  retry_wait: ['Import retry scheduled', 'Imported items are safe. Classifarr will retry automatically; learning is waiting.'],
  legacy_owner_unknown: ['Import owner needs verification', 'An older or external scan has no verifiable owner. Confirm that worker has stopped before reconciling its status.'],
  disabled: ['Import paused', 'The library or media server is disabled. Enable it when you want imports to resume.'],
  unconfigured: ['Import waiting for setup', 'Configure the media server connection before imports can resume.'],
}
const preflight = computed(() => {
  const value = props.library.ingestion_status?.preflight
  return !props.unavailable && state.value === 'retry_wait' && ['media', 'collections'].includes(value?.phase) &&
    typeof value?.message === 'string' && typeof value?.nextStep === 'string' ? value : null
})
const title = computed(() => props.unavailable ? 'Import status unavailable'
  : preflight.value ? `${preflight.value.phase === 'media' ? 'Media' : 'Collection'} import check needs attention`
    : (copy[state.value]?.[0] ?? 'Import status unknown'))
const nextStep = computed(() => props.unavailable ? 'The last status may be out of date. Reconnecting automatically.'
  : preflight.value ? `${preflight.value.message} ${preflight.value.nextStep}` : (copy[state.value]?.[1] ?? 'Refresh to check this library.'))
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0
const percentage = computed(() => {
  if (state.value !== 'active') return null
  const total = props.library.ingestion_status?.total
  const done = props.library.ingestion_status?.items
  return Number.isSafeInteger(total) && total > 0 && Number.isSafeInteger(done) && done >= 0
    ? Math.min(100, Math.round(done / total * 100)) : null
})
const retryAt = computed(() => {
  const raw = props.library.ingestion_status?.retryAt
  if (!raw) return null
  const date = new Date(raw)
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : null
})
</script>
