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

    <div class="rounded-md border border-current/20 bg-black/10 p-3 text-xs">
      <label
        class="flex items-start gap-2 font-semibold"
        :class="tmdbLivePreviewControlDisabled ? 'opacity-70' : ''"
      >
        <input
          type="checkbox"
          class="mt-0.5 h-4 w-4 rounded border-current/40 bg-background"
          :checked="tmdbLivePreviewControlChecked"
          :disabled="tmdbLivePreviewControlDisabled"
          aria-describedby="tmdb-live-preview-opt-in-description"
          aria-label="Request TMDB live metadata preview on next replay"
          @change="updateTmdbLivePreviewOptIn"
        >
        <span>Request TMDB live metadata preview on next replay</span>
      </label>
      <p
        id="tmdb-live-preview-opt-in-description"
        class="mt-1 opacity-80"
      >
        Advanced opt-in for a bounded read-only TMDB metadata check. It remains
        disabled until a normal replay preview confirms server opt-in, provider
        readiness, quota safety, and no active cooldown.
      </p>
      <div class="mt-2 flex flex-wrap gap-2">
        <span class="rounded-full border border-current/25 px-2 py-1">
          Gate: {{ tmdbLivePreviewGateLabel }}
        </span>
        <span class="rounded-full border border-current/25 px-2 py-1">
          {{ tmdbLivePreviewControlChecked ? 'Request opt-in selected' : 'Request opt-in off' }}
        </span>
      </div>
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
        <span
          v-if="sampleDiagnostics.enabled"
          class="rounded-full border border-current/30 px-2 py-1"
        >
          Selection: {{ formatLabel(sampleDiagnostics.selection_status) }}
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
        <span
          v-if="evidenceCompleteness.enabled"
          class="rounded-full border border-current/30 px-2 py-1"
        >
          Evidence: {{ evidenceSummary }}
        </span>
        <span
          v-if="enrichmentEligibility.enabled"
          class="rounded-full border border-current/30 px-2 py-1"
        >
          Enrichment: {{ enrichmentSummary }}
        </span>
        <span
          v-if="providerReadiness.enabled"
          class="rounded-full border border-current/30 px-2 py-1"
        >
          Providers: {{ providerReadinessSummary }}
        </span>
        <span
          v-if="enrichmentAdapterContract.enabled"
          class="rounded-full border border-current/30 px-2 py-1"
        >
          Adapters: {{ enrichmentAdapterSummary }}
        </span>
        <span
          v-if="tmdbMetadataAdapter.enabled"
          class="rounded-full border border-current/30 px-2 py-1"
        >
          TMDB dry-run: {{ tmdbMetadataAdapterSummary }}
        </span>
        <span
          v-if="tmdbMetadataCoverage.enabled"
          class="rounded-full border border-current/30 px-2 py-1"
        >
          TMDB coverage: {{ tmdbMetadataCoverageSummary }}
        </span>
      </div>

      <div
        v-if="sampleDiagnostics.enabled"
        class="rounded-md border border-current/20 bg-black/10 p-3 text-xs"
      >
        <div class="font-semibold">
          Sample selection diagnostics
        </div>
        <div class="mt-2 flex flex-wrap gap-2">
          <span class="rounded-full border border-current/25 px-2 py-1">
            Total history: {{ sampleDiagnostics.total_history_count }}
          </span>
          <span class="rounded-full border border-current/25 px-2 py-1">
            Eligible: {{ sampleDiagnostics.eligible_history_count }}
          </span>
          <span class="rounded-full border border-current/25 px-2 py-1">
            Final: {{ sampleDiagnostics.final_success_count }}
          </span>
          <span class="rounded-full border border-current/25 px-2 py-1">
            Review/Pending: {{ sampleDiagnostics.review_or_pending_count }}
          </span>
          <span
            v-if="sampleDiagnostics.media_type_filtered_out_count > 0"
            class="rounded-full border border-current/25 px-2 py-1"
          >
            Media filtered: {{ sampleDiagnostics.media_type_filtered_out_count }}
          </span>
          <span
            v-if="sampleDiagnostics.sparse_evidence_count > 0"
            class="rounded-full border border-current/25 px-2 py-1"
          >
            Sparse evidence: {{ sampleDiagnostics.sparse_evidence_count }}
          </span>
        </div>
      </div>

      <div
        v-if="providerReadiness.enabled"
        class="rounded-md border border-current/20 bg-black/10 p-3 text-xs"
      >
        <div class="font-semibold">
          Provider readiness
        </div>
        <p class="mt-1 opacity-80">
          Checks configuration, cooldown, and quota state without live provider calls.
        </p>
        <div class="mt-2 flex flex-wrap gap-2">
          <span class="rounded-full border border-current/25 px-2 py-1">
            Readiness: {{ formatLabel(providerReadiness.readiness) }}
          </span>
          <span class="rounded-full border border-current/25 px-2 py-1">
            Ready sources: {{ providerReadiness.ready_source_count }} / {{ providerReadiness.source_count }}
          </span>
          <span class="rounded-full border border-current/25 px-2 py-1">
            Demanded sources: {{ providerReadiness.demanded_source_count }}
          </span>
          <span class="rounded-full border border-current/25 px-2 py-1">
            No live calls
          </span>
        </div>
        <div class="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
          <div
            v-for="source in providerReadiness.sources"
            :key="source.source"
            class="rounded border border-current/15 bg-black/10 px-2 py-1.5"
          >
            <div class="font-semibold">
              {{ formatLabel(source.source) }}: {{ formatLabel(source.status) }}
            </div>
            <div class="mt-1 opacity-80">
              {{ source.configured ? 'Configured' : 'Not configured' }}
              <span v-if="source.quota_safe">
                - quota safe
              </span>
              <span v-else>
                - quota unavailable
              </span>
            </div>
            <div
              v-if="source.selected_provider_key"
              class="mt-1 opacity-80"
            >
              Provider: {{ source.selected_provider_key }}
            </div>
            <div class="mt-1 opacity-80">
              Eligible samples: {{ source.eligible_sample_count }}
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="enrichmentAdapterContract.enabled"
        class="rounded-md border border-current/20 bg-black/10 p-3 text-xs"
      >
        <div class="font-semibold">
          Replay enrichment adapters
        </div>
        <p class="mt-1 opacity-80">
          Defines which read-only enrichment adapters replay may use. No adapter runs unless explicitly enabled.
        </p>
        <div class="mt-2 flex flex-wrap gap-2">
          <span class="rounded-full border border-current/25 px-2 py-1">
            Readiness: {{ formatLabel(enrichmentAdapterContract.readiness) }}
          </span>
          <span class="rounded-full border border-current/25 px-2 py-1">
            Enabled: {{ enrichmentAdapterContract.enabled_adapter_count }} / {{ enrichmentAdapterContract.adapter_count }}
          </span>
          <span class="rounded-full border border-current/25 px-2 py-1">
            Demanded: {{ enrichmentAdapterContract.demanded_adapter_count }}
          </span>
          <span class="rounded-full border border-current/25 px-2 py-1">
            Blocked: {{ enrichmentAdapterContract.blocked_adapter_count }}
          </span>
        </div>
        <div class="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
          <div
            v-for="source in enrichmentAdapterContract.sources"
            :key="source.source"
            class="rounded border border-current/15 bg-black/10 px-2 py-1.5"
          >
            <div class="font-semibold">
              {{ formatLabel(source.source) }}: {{ formatLabel(source.status) }}
            </div>
            <div class="mt-1 opacity-80">
              {{ source.enabled ? 'Adapter enabled' : 'Adapter blocked' }}
              <span v-if="source.provider_ready">
                - provider ready
              </span>
              <span v-else>
                - provider unavailable
              </span>
            </div>
            <div
              v-if="source.selected_provider_key"
              class="mt-1 opacity-80"
            >
              Provider: {{ source.selected_provider_key }}
            </div>
            <div class="mt-1 opacity-80">
              Eligible samples: {{ source.eligible_sample_count }}
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="tmdbMetadataAdapter.enabled"
        class="rounded-md border border-current/20 bg-black/10 p-3 text-xs"
      >
        <div class="font-semibold">
          TMDB metadata dry-run adapter
        </div>
        <p class="mt-1 opacity-80">
          Previews whether TMDB metadata could fill sparse replay evidence. Output is sanitized and never includes provider payloads or identifiers.
        </p>
        <div class="mt-2 flex flex-wrap gap-2">
          <span class="rounded-full border border-current/25 px-2 py-1">
            Status: {{ formatLabel(tmdbMetadataAdapter.status) }}
          </span>
          <span class="rounded-full border border-current/25 px-2 py-1">
            Switch: {{ formatLabel(tmdbMetadataExecutionSwitch.status) }}
          </span>
          <span class="rounded-full border border-current/25 px-2 py-1">
            Previewed: {{ tmdbMetadataAdapter.previewed_count }} / {{ tmdbMetadataAdapter.preview_limit }}
          </span>
          <span class="rounded-full border border-current/25 px-2 py-1">
            Improved samples: {{ tmdbMetadataAdapter.improved_sample_count }}
          </span>
          <span class="rounded-full border border-current/25 px-2 py-1">
            Improved fields: {{ tmdbMetadataAdapter.improved_field_count }}
          </span>
          <span class="rounded-full border border-current/25 px-2 py-1">
            Provider payload hidden
          </span>
          <span
            v-if="tmdbMetadataExecutionSwitch.selected_provider_key"
            class="rounded-full border border-current/25 px-2 py-1"
          >
            Provider: {{ tmdbMetadataExecutionSwitch.selected_provider_key }}
          </span>
          <span class="rounded-full border border-current/25 px-2 py-1">
            {{ tmdbMetadataExecutionSwitch.server_enabled ? 'Server opt-in on' : 'Server opt-in off' }}
          </span>
          <span class="rounded-full border border-current/25 px-2 py-1">
            {{ tmdbMetadataExecutionSwitch.quota_safe ? 'Quota safe' : 'Quota unavailable' }}
          </span>
        </div>
      </div>

      <div
        v-if="tmdbMetadataCoverage.enabled"
        class="rounded-md border border-current/20 bg-black/10 p-3 text-xs"
      >
        <div class="font-semibold">
          TMDB metadata coverage comparison
        </div>
        <p class="mt-1 opacity-80">
          Compares existing replay evidence with sanitized TMDB field availability. It reports field names only.
        </p>
        <div class="mt-2 flex flex-wrap gap-2">
          <span class="rounded-full border border-current/25 px-2 py-1">
            Status: {{ formatLabel(tmdbMetadataCoverage.status) }}
          </span>
          <span class="rounded-full border border-current/25 px-2 py-1">
            Added fields: {{ tmdbMetadataCoverage.added_field_count }}
          </span>
          <span class="rounded-full border border-current/25 px-2 py-1">
            Improved samples: {{ tmdbMetadataCoverage.improved_sample_count }}
          </span>
          <span class="rounded-full border border-current/25 px-2 py-1">
            Strong after: {{ tmdbMetadataCoverage.after_strong_count }} / {{ tmdbMetadataCoverage.sample_count }}
          </span>
          <span class="rounded-full border border-current/25 px-2 py-1">
            Remaining missing: {{ tmdbMetadataCoverage.remaining_missing_field_count }}
          </span>
        </div>
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
              v-if="sampleEvidence(sample)"
              class="mt-1 opacity-80"
            >
              Evidence: {{ formatLabel(sampleEvidence(sample).completeness) }}
              <span v-if="sampleEvidence(sample).available_fields.length > 0">
                ({{ sampleEvidence(sample).available_fields.join(', ') }})
              </span>
            </div>
            <div
              v-if="sampleEnrichment(sample)"
              class="mt-1 opacity-80"
            >
              Enrichment: {{ formatLabel(sampleEnrichment(sample).status) }}
              <span v-if="sampleEnrichment(sample).eligible_sources.length > 0">
                via {{ sampleEnrichment(sample).eligible_sources.map(formatLabel).join(', ') }}
              </span>
            </div>
            <div
              v-if="sampleTmdbCoverage(sample)"
              class="mt-1 opacity-80"
            >
              TMDB coverage: {{ formatLabel(sampleTmdbCoverage(sample).status) }}
              <span v-if="sampleTmdbCoverage(sample).added_fields.length > 0">
                adds {{ sampleTmdbCoverage(sample).added_fields.join(', ') }}
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
import { computed, watch } from 'vue'
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
  tmdbLivePreviewOptIn: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits({
  preview: () => true,
  'update:tmdbLivePreviewOptIn': value => typeof value === 'boolean',
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
const sampleDiagnostics = computed(() => props.preview?.sample?.diagnostics || { enabled: false })
const impactLabel = computed(() => props.preview?.impact_summary?.impact_level || 'unknown')
const scoring = computed(() => props.preview?.dry_run_scoring || { enabled: false, items: [] })
const parityDelta = computed(() => props.preview?.parity_delta || { enabled: false, items: [] })
const evidenceCompleteness = computed(() => (
  props.preview?.sample?.evidence_completeness || { enabled: false, items: [] }
))
const enrichmentEligibility = computed(() => (
  props.preview?.sample?.enrichment_eligibility || { enabled: false, items: [] }
))
const providerReadiness = computed(() => (
  props.preview?.sample?.provider_readiness || { enabled: false, sources: [] }
))
const enrichmentAdapterContract = computed(() => (
  props.preview?.sample?.enrichment_adapter_contract || { enabled: false, sources: [] }
))
const tmdbMetadataAdapter = computed(() => (
  props.preview?.sample?.tmdb_metadata_adapter_preview || { enabled: false, items: [] }
))
const tmdbMetadataCoverage = computed(() => (
  props.preview?.sample?.tmdb_metadata_coverage_comparison || { enabled: false, items: [] }
))
const tmdbMetadataExecutionSwitch = computed(() => (
  tmdbMetadataAdapter.value.execution_switch || {
    status: 'blocked',
    server_enabled: false,
    provider_ready: false,
    quota_safe: false,
    cooldown_active: false,
    selected_provider_key: null,
  }
))
const tmdbLivePreviewCanRequest = computed(() => {
  const executionSwitch = tmdbMetadataExecutionSwitch.value
  return (
    executionSwitch.server_enabled === true &&
    executionSwitch.provider_ready === true &&
    executionSwitch.quota_safe === true &&
    executionSwitch.cooldown_active !== true
  )
})
const tmdbLivePreviewControlDisabled = computed(() => (
  props.disabled ||
  props.loading ||
  !tmdbLivePreviewCanRequest.value
))
const tmdbLivePreviewControlChecked = computed(() => (
  props.tmdbLivePreviewOptIn === true &&
  !tmdbLivePreviewControlDisabled.value
))
const tmdbLivePreviewGateLabel = computed(() => {
  if (!props.preview) return 'run normal replay first'

  const executionSwitch = tmdbMetadataExecutionSwitch.value
  if (executionSwitch.server_enabled !== true) return 'server opt-in required'
  if (executionSwitch.provider_ready !== true) return 'provider not ready'
  if (executionSwitch.quota_safe !== true) return 'quota unavailable'
  if (executionSwitch.cooldown_active === true) return 'provider cooldown active'
  return 'available'
})
const scoringBySampleId = computed(() => new Map(
  (scoring.value.items || []).map(item => [item.sample_id, item])
))
const deltaBySampleId = computed(() => new Map(
  (parityDelta.value.items || []).map(item => [item.sample_id, item])
))
const evidenceBySampleId = computed(() => new Map(
  (evidenceCompleteness.value.items || []).map(item => [item.sample_id, item])
))
const enrichmentBySampleId = computed(() => new Map(
  (enrichmentEligibility.value.items || []).map(item => [item.sample_id, item])
))
const tmdbCoverageBySampleId = computed(() => new Map(
  (tmdbMetadataCoverage.value.items || []).map(item => [item.sample_id, item])
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
const evidenceSummary = computed(() => {
  if (!evidenceCompleteness.value.enabled) return 'not analyzed'
  return [
    `${evidenceCompleteness.value.strong_count || 0} strong`,
    `${evidenceCompleteness.value.partial_count || 0} partial`,
    `${evidenceCompleteness.value.sparse_count || 0} sparse`,
  ].join(' / ')
})
const enrichmentSummary = computed(() => {
  if (!enrichmentEligibility.value.enabled) return 'not checked'
  return [
    `${enrichmentEligibility.value.eligible_count || 0} eligible`,
    `${enrichmentEligibility.value.not_needed_count || 0} not needed`,
    `${enrichmentEligibility.value.insufficient_identity_count || 0} insufficient identity`,
    `${enrichmentEligibility.value.no_safe_source_count || 0} no safe source`,
  ].join(' / ')
})
const providerReadinessSummary = computed(() => {
  if (!providerReadiness.value.enabled) return 'not checked'
  return [
    formatLabel(providerReadiness.value.readiness || 'not_needed'),
    `${providerReadiness.value.ready_source_count || 0} ready`,
    `${providerReadiness.value.unavailable_source_count || 0} unavailable`,
  ].join(' / ')
})
const enrichmentAdapterSummary = computed(() => {
  if (!enrichmentAdapterContract.value.enabled) return 'not defined'
  return [
    formatLabel(enrichmentAdapterContract.value.readiness || 'not_needed'),
    `${enrichmentAdapterContract.value.enabled_adapter_count || 0} enabled`,
    `${enrichmentAdapterContract.value.blocked_adapter_count || 0} blocked`,
  ].join(' / ')
})
const tmdbMetadataAdapterSummary = computed(() => {
  if (!tmdbMetadataAdapter.value.enabled) return 'not checked'
  return [
    formatLabel(tmdbMetadataAdapter.value.status || 'blocked'),
    `${tmdbMetadataAdapter.value.previewed_count || 0} previewed`,
    `${tmdbMetadataAdapter.value.improved_field_count || 0} fields`,
  ].join(' / ')
})
const tmdbMetadataCoverageSummary = computed(() => {
  if (!tmdbMetadataCoverage.value.enabled) return 'not compared'
  return [
    formatLabel(tmdbMetadataCoverage.value.status || 'not_needed'),
    `${tmdbMetadataCoverage.value.added_field_count || 0} added`,
    `${tmdbMetadataCoverage.value.upgraded_completeness_count || 0} upgraded`,
  ].join(' / ')
})

function sampleScoring(sample) {
  return scoringBySampleId.value.get(sample.sample_id) || null
}

function sampleDelta(sample) {
  return deltaBySampleId.value.get(sample.sample_id) || null
}

function sampleEvidence(sample) {
  return evidenceBySampleId.value.get(sample.sample_id) || null
}

function sampleEnrichment(sample) {
  return enrichmentBySampleId.value.get(sample.sample_id) || null
}

function sampleTmdbCoverage(sample) {
  return tmdbCoverageBySampleId.value.get(sample.sample_id) || null
}

function formatLabel(value) {
  return String(value || 'unknown').replaceAll('_', ' ')
}

function updateTmdbLivePreviewOptIn(event) {
  emit('update:tmdbLivePreviewOptIn', event.target.checked === true && tmdbLivePreviewCanRequest.value)
}

watch(tmdbLivePreviewCanRequest, (canRequest) => {
  if (!canRequest && props.tmdbLivePreviewOptIn) {
    emit('update:tmdbLivePreviewOptIn', false)
  }
}, { immediate: true })
</script>
