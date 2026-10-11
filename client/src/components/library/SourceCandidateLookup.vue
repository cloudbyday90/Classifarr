<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    class="candidate-lookup"
    :aria-labelledby="`${id}-heading`"
  >
    <h4 :id="`${id}-heading`">
      Find candidate IDs
    </h4>
    <p>Look up the IDs supplied by your media server. Results are suggestions, not verified mappings. Nothing is selected or saved automatically.</p>
    <button
      type="button"
      :disabled="busy"
      @click="lookup"
    >
      Find candidate IDs
    </button>
    <button
      v-if="busy"
      type="button"
      @click="cancel"
    >
      Cancel lookup
    </button>
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ busy ? 'Looking up source identifiers…' : notice || (result ? `${result.candidates.length} ${result.candidates.length === 1 ? 'candidate' : 'candidates'} found. Nothing was saved.` : '') }}
      <span v-if="!busy && result?.identityAudit">{{ result.identityAudit.status === 'catalog_agreement' ? 'Identifier audit: catalog agreement found; complete scope still needs verification.' : 'Identifier audit: unresolved evidence remains; review the reasons below.' }}</span>
    </p>
    <p
      v-if="error"
      role="alert"
    >
      {{ error }}
    </p>
    <template v-if="result">
      <section
        v-if="result.identityAudit"
        aria-label="Identifier agreement audit"
      >
        <h5>Can these identifiers be reconciled automatically?</h5>
        <p v-if="result.identityAudit.status === 'catalog_agreement'">
          Every checked identifier points to TMDb {{ result.identityAudit.candidateTmdbId }} in this catalog. This is catalog agreement, not independent proof that the source IDs are aliases.
        </p>
        <p v-else>
          Not established. The lookup found these gaps:
        </p>
        <ul v-if="result.identityAudit.blockers.length">
          <li
            v-for="code in result.identityAudit.blockers"
            :key="code"
          >
            {{ identityAgreementBlockers[code] }}
          </li>
        </ul>
        <p>Audit only. No repair was authorized. Complete source and catalog scope still needs verification, including every season of a grouped show.</p>
      </section>
      <p v-if="!result.candidates.length">
        No whole-movie or series candidates were found from these source identifiers. This does not mean the item has no metadata.
      </p>
      <ul aria-label="Catalog candidates">
        <li
          v-for="candidate in result.candidates"
          :key="candidate.tmdbId"
        >
          <strong>{{ candidate.available ? candidate.title : 'Catalog details not found' }}</strong>
          <span v-if="candidate.releaseDate"> ({{ candidate.releaseDate }})</span>
          <p>TMDb {{ source.mediaType === 'tv' ? 'series' : 'movie' }} ID: {{ candidate.tmdbId }}</p>
          <p>From: {{ candidate.lookupIndexes.map(index => `${candidateProviderLabels[result.lookups[index].provider]} ${result.lookups[index].id}`).join(', ') }}</p>
        </li>
      </ul>
      <details>
        <summary>Identifier lookup results</summary>
        <ul>
          <li
            v-for="(entry, index) in result.lookups"
            :key="index"
          >
            {{ candidateProviderLabels[entry.provider] }} {{ entry.id }}: {{ candidateLookupLabels[entry.status] }}.
            <span v-if="entry.otherScopeMatches">{{ entry.otherScopeMatches }} matches in other types or scopes; these were not used as whole-work candidates.</span>
          </li>
        </ul>
      </details>
      <p>To review a candidate, enter its TMDb ID in the draft below. For grouped shows, every source season must still be verified before approval.</p>
      <p class="reference">
        Lookup reference: {{ result.reference }}
      </p>
    </template>
  </section>
</template>

<script setup>
import { useId } from 'vue'
import { useSourceCandidates } from '@/composables/useSourceCandidates'
import { candidateLookupLabels, candidateProviderLabels } from '@/utils/sourceCandidates'
import { identityAgreementBlockers } from '@/utils/sourceIdentityAgreement'
const props = defineProps({ source: { type: Object, required: true }, offset: { type: Number, required: true } })
const id = useId()
const { result, error, busy, notice, lookup, cancel } = useSourceCandidates(() => props.source, () => props.offset)
</script>

<style scoped>
.candidate-lookup { padding: .75rem; border: 1px solid #64748b; border-radius: .4rem; overflow-wrap: anywhere; }
p, li { margin: .75rem 0; }
ul { padding-left: 1.25rem; }
button, summary { min-height: 2.75rem; padding: .5rem; cursor: pointer; }
button { margin: .5rem .5rem 0 0; border: 1px solid #64748b; border-radius: .35rem; background: #1e293b; color: #f1f5f9; }
button:disabled { opacity: .5; cursor: not-allowed; }
:is(button, summary):focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
.reference { font-size: .875rem; color: #cbd5e1; }
</style>
