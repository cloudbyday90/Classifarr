<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section aria-label="Draft source and catalog evidence">
    <p>Check this proposal against fresh source and TMDb reads. This may take up to 90 seconds. Nothing will be saved or applied.</p>
    <button
      type="button"
      :disabled="busy"
      @click="inspect"
    >
      Check source and catalog evidence
    </button>
    <button
      v-if="busy"
      type="button"
      @click="cancel"
    >
      Cancel evidence check
    </button>
    <p
      v-if="error"
      role="alert"
    >
      {{ error }}
    </p>
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <template v-if="busy">
        Checking source and catalog evidence…
      </template>
      <template v-else-if="result">
        {{ result.matched }} of {{ result.total }} {{ result.unit === 'episode' ? 'episodes have matching catalog membership' : 'movies match the source TMDb declaration' }}.
        {{ result.exclusions.length }} excluded from this comparison. This evidence check did not enable backfill or resolve the conflict.
      </template>
      <template v-else>
        {{ notice }}
      </template>
    </p>
    <template v-if="result">
      <p>Membership is not independent cross-provider identity verification. Your explicit approval is still required.</p>
      <section
        v-if="result.catalogWorks.length"
        aria-label="Catalog works checked"
      >
        <h5>Catalog works checked</h5>
        <ul>
          <li
            v-for="work in result.catalogWorks"
            :key="work.tmdbId"
          >
            {{ work.title }}{{ work.releaseDate ? ` (${work.releaseDate})` : '' }} —
            TMDb {{ work.mediaType === 'tv' ? 'series' : 'movie' }} {{ work.tmdbId }}
          </li>
        </ul>
        <p>These are the works in your proposal, not automatically selected matches. Check their identity before approval.</p>
      </section>
      <section
        v-if="result.exclusions.length || !result.total"
        aria-label="How to review this mapping"
      >
        <h5>What to check next</h5>
        <p v-if="!result.total">
          {{ guidance.empty_source }}
        </p>
        <p
          v-for="reason in [...new Set(result.exclusions.map(item => item.reason))]"
          :key="reason"
        >
          {{ guidance[reason] }}
        </p>
      </section>
      <details v-if="result.exclusions.length">
        <summary>View excluded {{ result.unit === 'episode' ? 'episodes' : 'movie' }} ({{ result.exclusions.length }})</summary>
        <ul>
          <li
            v-for="(item, index) in result.exclusions"
            :key="index"
          >
            <template v-if="result.unit === 'episode'">
              Season {{ item.season }}, episode {{ item.episode }}:
            </template>
            {{ scopeExclusionLabels[item.reason] }}.
          </li>
        </ul>
      </details>
      <p class="reference">
        Evidence reference: {{ result.reference }}
      </p>
      <SourceMappingApproval
        v-if="result.evidenceFingerprint && result.total > 0 && result.matched === result.total && !result.exclusions.length && (draft.scope.kind === 'whole_work' || draft.scope.coverage === 'complete')"
        :key="result.reference"
        :draft="draft"
        :evidence="result"
        :offset="offset"
      />
    </template>
  </section>
</template>

<script setup>
import { useSourceScopeEvidence } from '@/composables/useSourceScopeEvidence'
import { scopeExclusionLabels } from '@/utils/sourceScopeEvidence'
import { sourceMappingGuidance as guidance } from '@/utils/sourceMappingGuidance'
import SourceMappingApproval from './SourceMappingApproval.vue'
const props = defineProps({ draft: { type: Object, required: true }, offset: { type: Number, required: true } })
const { result, error, busy, notice, inspect, cancel } = useSourceScopeEvidence(() => props.draft, () => props.offset)
</script>

<style scoped>
section { margin-top: 1rem; border-top: 1px solid #64748b; padding-top: .75rem; }
p, li { margin: .75rem 0; overflow-wrap: anywhere; }
button, summary { min-height: 2.75rem; padding: .5rem; cursor: pointer; }
button { border: 1px solid #64748b; border-radius: .35rem; margin-right: .5rem; background: #1e293b; color: #f1f5f9; }
button:disabled { opacity: .5; cursor: not-allowed; }
:is(button, summary):focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
.reference { overflow-wrap: anywhere; font-size: .875rem; }
</style>
