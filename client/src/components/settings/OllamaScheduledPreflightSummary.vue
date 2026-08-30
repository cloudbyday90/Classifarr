<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    class="space-y-4"
    aria-labelledby="ollama-scheduled-preflight-heading"
  >
    <div class="space-y-1">
      <h4
        id="ollama-scheduled-preflight-heading"
        class="font-medium text-gray-200"
      >
        Scheduled local preflight
      </h4>
      <p class="text-sm text-gray-400">
        The last background availability observation. It is separate from saved strict-verification readiness and does not change routing.
      </p>
    </div>

    <p
      v-if="loading && !hasPreflightResult"
      class="text-sm text-gray-400"
    >
      Loading scheduled preflight summary…
    </p>

    <p
      v-else-if="!hasPreflightResult"
      class="text-sm text-gray-500"
    >
      No scheduled preflight has run yet.
    </p>

    <div
      v-else
      class="grid grid-cols-1 gap-4 xl:grid-cols-2"
    >
      <article
        v-for="entry in entries"
        :key="entry.id"
        class="space-y-3 rounded-lg border border-gray-700 bg-gray-800/50 p-4"
      >
        <div class="flex items-center justify-between gap-3">
          <h5 class="font-medium text-gray-200">
            {{ entry.label }}
          </h5>
          <span :class="entry.statusClassName">
            {{ entry.statusLabel }}
          </span>
        </div>

        <dl class="space-y-2 text-sm">
          <div class="flex items-start justify-between gap-3">
            <dt class="text-gray-400">
              Last checked
            </dt>
            <dd class="text-right text-gray-200">
              {{ entry.checkedAt }}
            </dd>
          </div>
          <div
            v-if="entry.failureType"
            class="flex items-start justify-between gap-3"
          >
            <dt class="text-gray-400">
              Failure type
            </dt>
            <dd class="text-right text-amber-300">
              {{ entry.failureType }}
            </dd>
          </div>
          <div
            v-if="entry.nextScheduledAt"
            class="flex items-start justify-between gap-3"
          >
            <dt class="text-gray-400">
              Next scheduled attempt
            </dt>
            <dd class="text-right text-gray-200">
              {{ entry.nextScheduledAt }}
            </dd>
          </div>
        </dl>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  report: {
    type: Object,
    default: () => ({ ai: null, embedding: null }),
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

function asSafeTimestamp(value) {
  const timestamp = Date.parse(String(value || ''))
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toLocaleString()
    : 'Not available'
}

function asSafeFailureType(value) {
  const normalized = String(value || '').trim()
  return /^[A-Za-z][A-Za-z0-9 _-]{0,63}$/.test(normalized)
    ? normalized
    : null
}

function buildEntry(id, label, result) {
  if (!result || typeof result !== 'object') return null

  const statusLabel = result.skipped === true
    ? 'Skipped'
    : result.success === true
      ? 'Healthy'
      : 'Degraded'
  const statusClassName = result.skipped === true
    ? 'text-xs font-medium text-amber-300'
    : result.success === true
      ? 'text-xs font-medium text-green-400'
      : 'text-xs font-medium text-red-300'

  return {
    id,
    label,
    statusLabel,
    statusClassName,
    checkedAt: asSafeTimestamp(result.checkedAt || result.checked_at),
    failureType: asSafeFailureType(result.failureType),
    nextScheduledAt: result.nextScheduledAt
      ? asSafeTimestamp(result.nextScheduledAt)
      : null,
  }
}

const entries = computed(() => [
  buildEntry('ai', 'AI model', props.report?.ai),
  buildEntry('embedding', 'Embedding model', props.report?.embedding),
].filter(Boolean))

const hasPreflightResult = computed(() => entries.value.length > 0)
</script>
