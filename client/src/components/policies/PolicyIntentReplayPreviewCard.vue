<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    class="rounded-lg border p-4 space-y-3"
    :class="cardClass"
    aria-label="Representative replay preview"
  >
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h4 class="font-semibold flex items-center gap-2">
          <span
            class="text-primary"
            aria-hidden="true"
          >
            Replay
          </span>
          Representative Replay Preview
        </h4>
        <p class="text-xs opacity-80 mt-1 max-w-2xl">
          Check which recent classifications Classifarr can safely replay
          against. This is read-only and does not run classification, AI,
          providers, or arr writes.
        </p>
      </div>

      <Button
        variant="secondary"
        size="sm"
        :disabled="disabled || loading"
        @click="emit('preview')"
      >
        {{ loading ? 'Checking...' : actionLabel }}
      </Button>
    </div>

    <div
      v-if="stale && !error"
      class="rounded-md border border-amber-700/70 bg-amber-950/30 p-3 text-sm text-amber-100"
      role="status"
      aria-live="polite"
    >
      <div class="font-semibold">
        Replay preview is out of date
      </div>
      <p class="mt-1 text-xs opacity-90">
        The draft changed after these samples were selected. Refresh replay
        preview before treating them as current.
      </p>
    </div>

    <div
      v-if="error"
      class="rounded-md border border-red-700/70 bg-red-950/30 p-3 text-sm text-red-100"
      role="alert"
    >
      {{ error }}
    </div>

    <div
      v-else-if="notice"
      role="status"
      aria-live="polite"
      class="space-y-3"
    >
      <div>
        <div class="font-semibold">
          {{ notice.title }}
        </div>
        <p class="text-sm opacity-90">
          {{ notice.message }}
        </p>
      </div>

      <div class="flex flex-wrap gap-2 text-xs">
        <span class="rounded-full border border-current/30 px-2 py-1">
          Readiness: {{ readinessLabel }}
        </span>
        <span class="rounded-full border border-current/30 px-2 py-1">
          Samples: {{ returnedCount }} / {{ requestedLimit }}
        </span>
        <span class="rounded-full border border-current/30 px-2 py-1">
          Impact: {{ impactLabel }}
        </span>
        <span class="rounded-full border border-current/30 px-2 py-1">
          No execution
        </span>
        <span
          v-if="scoring.enabled"
          class="rounded-full border border-current/30 px-2 py-1"
        >
          Dry-run fit: {{ scoringSummary }}
        </span>
        <span
          v-if="parityDelta.enabled"
          class="rounded-full border border-current/30 px-2 py-1"
        >
          Delta: {{ paritySummary }}
        </span>
      </div>

      <div
        v-if="samples.length > 0"
        class="grid grid-cols-1 md:grid-cols-2 gap-2"
      >
        <div
          v-for="sample in samples"
          :key="sample.sample_id"
          class="rounded-md border border-current/20 bg-black/10 p-3 text-xs"
        >
          <div class="font-semibold text-sm">
            {{ sample.title }}
            <span
              v-if="sample.year"
              class="opacity-70 font-normal"
            >
              ({{ sample.year }})
            </span>
          </div>
          <div class="mt-1 opacity-80">
            {{ sample.media_type || 'unknown' }} - {{ sample.library_name || 'Unknown library' }}
          </div>
          <div class="mt-2 flex flex-wrap gap-2">
            <span class="rounded-full border border-current/25 px-2 py-1">
              {{ sample.current_status }}
            </span>
            <span class="rounded-full border border-current/25 px-2 py-1">
              {{ sample.current_method }}
            </span>
            <span class="rounded-full border border-current/25 px-2 py-1">
              {{ sample.current_confidence ?? 0 }}%
            </span>
          </div>
          <div
            v-if="sampleScoring(sample)"
            class="mt-2 rounded-md border border-current/15 bg-black/10 px-2 py-1.5"
          >
            <div class="font-semibold">
              Draft fit: {{ formatLabel(sampleScoring(sample).draft_signal_fit) }}
            </div>
            <div class="mt-1 opacity-80">
              {{ formatLabel(sampleScoring(sample).recommendation) }}
            </div>
            <div
              v-if="sampleScoring(sample).policy_engine?.enabled"
              class="mt-1 opacity-80"
            >
              Policy engine:
              {{ sampleScoring(sample).policy_engine.policy_engine_score }}%
              ({{ formatLabel(sampleScoring(sample).policy_engine.policy_engine_fit) }})
            </div>
            <div
              v-if="sampleDelta(sample)"
              class="mt-1 opacity-80"
            >
              Delta: {{ formatLabel(sampleDelta(sample).delta_action) }}
              <span v-if="sampleDelta(sample).delta_level">
                ({{ formatLabel(sampleDelta(sample).delta_level) }})
              </span>
            </div>
            <div
              v-if="sampleScoring(sample).exclusion_hits.length > 0"
              class="mt-1 text-red-100"
            >
              Blocks: {{ sampleScoring(sample).exclusion_hits.join(', ') }}
            </div>
            <div
              v-else-if="sampleScoring(sample).policy_engine?.blockers?.length > 0"
              class="mt-1 text-red-100"
            >
              Policy engine blocks:
              {{ sampleScoring(sample).policy_engine.blockers.join(', ') }}
            </div>
            <div
              v-else-if="sampleScoring(sample).missing_required.length > 0"
              class="mt-1 text-amber-100"
            >
              Missing: {{ sampleScoring(sample).missing_required.join(', ') }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else
      class="rounded-md border border-gray-700 bg-background-light p-3 text-sm text-gray-300"
    >
      No representative replay preview has been run for this draft yet.
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import Button from '@/components/common/Button.vue'

const props = defineProps({
  preview: {
    type: Object,
    default: null,
  },
  notice: {
    type: Object,
    default: null,
  },
  samples: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  stale: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: null,
  },
})

const emit = defineEmits({
  preview: () => true,
})

const actionLabel = computed(() => {
  if (props.stale) return 'Refresh Replay'
  return props.preview ? 'Refresh Replay' : 'Preview Replay'
})

const cardClass = computed(() => {
  const tone = props.notice?.tone
  if (props.error || tone === 'error') return 'border-red-700/70 bg-red-950/20 text-red-100'
  if (props.stale) return 'border-amber-700/70 bg-amber-950/20 text-amber-100'
  if (tone === 'warning') return 'border-amber-700/70 bg-amber-950/20 text-amber-100'
  if (tone === 'success') return 'border-cyan-800/70 bg-cyan-950/20 text-cyan-100'
  return 'border-blue-800/70 bg-blue-950/20 text-blue-100'
})

const requestedLimit = computed(() => props.preview?.sample?.requested_limit ?? 0)
const returnedCount = computed(() => props.preview?.sample?.returned_count ?? props.samples.length)
const readinessLabel = computed(() => props.preview?.sample?.readiness || 'unavailable')
const impactLabel = computed(() => props.preview?.impact_summary?.impact_level || 'unknown')
const scoring = computed(() => props.preview?.dry_run_scoring || { enabled: false, items: [] })
const parityDelta = computed(() => props.preview?.parity_delta || { enabled: false, items: [] })
const scoringBySampleId = computed(() => new Map(
  (scoring.value.items || []).map(item => [item.sample_id, item])
))
const deltaBySampleId = computed(() => new Map(
  (parityDelta.value.items || []).map(item => [item.sample_id, item])
))
const scoringSummary = computed(() => {
  if (!scoring.value.enabled) return 'not run'
  return [
    `${scoring.value.strong_fit_count || 0} strong`,
    `${scoring.value.review_count || 0} review`,
    `${scoring.value.blocked_count || 0} blocked`,
    `${scoring.value.insufficient_count || 0} insufficient`,
  ].join(' / ')
})
const paritySummary = computed(() => {
  if (!parityDelta.value.enabled) return 'not compared'
  return [
    `${parityDelta.value.would_remain_count || 0} remain`,
    `${parityDelta.value.would_now_candidate_count || 0} candidate`,
    `${parityDelta.value.would_now_review_count || 0} review`,
    `${parityDelta.value.would_now_block_count || 0} block`,
    `${parityDelta.value.insufficient_count || 0} insufficient`,
  ].join(' / ')
})

function sampleScoring(sample) {
  return scoringBySampleId.value.get(sample.sample_id) || null
}

function sampleDelta(sample) {
  return deltaBySampleId.value.get(sample.sample_id) || null
}

function formatLabel(value) {
  return String(value || 'unknown').replaceAll('_', ' ')
}
</script>
