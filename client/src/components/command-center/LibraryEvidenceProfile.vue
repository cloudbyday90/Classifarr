<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <component
    :is="detailsContainer"
    v-if="profile"
    class="library-evidence-profile"
  >
    <summary v-if="detailsMode === 'disclosure'">
      Compare {{ profile.candidates.length }} library choices
    </summary>
    <section
      class="library-evidence-profile-content"
      :aria-labelledby="headingId"
    >
      <h4 :id="headingId">
        Current-library comparison
      </h4>
      <p>
        This read-only comparison shows why each library was considered. It cannot route this item or change your policy.
      </p>
      <div class="library-evidence-profile-table-scroll">
        <table>
          <caption>
            Each check for each library. Existing contents are a useful clue, but do not prove where a new item belongs.
          </caption>
          <thead>
            <tr>
              <th scope="col">
                Evidence
              </th>
              <th
                v-for="candidate in candidates"
                :key="candidate.library_id"
                scope="col"
              >
                <span class="library-evidence-profile-rank">#{{ candidate.rank }}</span>
                {{ candidate.library_name }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                Policy score
              </th>
              <td
                v-for="candidate in candidates"
                :key="`score-${candidate.library_id}`"
              >
                {{ candidate.policy_score }}/100
                <span class="library-evidence-profile-secondary">
                  {{ candidate.rank === 1
                    ? 'Leading candidate'
                    : `${candidate.score_margin} points behind leading` }}
                </span>
              </td>
            </tr>
            <tr
              v-for="source in sources"
              :key="source.id"
            >
              <th scope="row">
                {{ source.label }}
              </th>
              <td
                v-for="candidate in candidates"
                :key="`${source.id}-${candidate.library_id}`"
                :class="`library-evidence-profile-state--${sourceFor(candidate, source.id).state_id}`"
              >
                {{ sourceFor(candidate, source.id).message }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </component>
</template>

<script setup>
import { computed } from 'vue'

import {
  getPolicyCandidateEvidenceCardPresentation,
} from '@/utils/policyCandidateEvidenceCardPresentation'
import {
  normalizePolicyLibraryEvidenceProfile,
} from '@/utils/policyLibraryEvidenceProfilePresentation'

const props = defineProps({
  itemId: {
    type: [Number, String],
    required: true,
  },
  value: {
    type: Object,
    default: () => null,
  },
  detailsMode: {
    type: String,
    default: 'disclosure',
    validator: value => ['disclosure', 'inline'].includes(value),
  },
})

const profile = computed(() => normalizePolicyLibraryEvidenceProfile(props.value))
const candidates = computed(() => (profile.value?.candidates || []).map((candidate) => ({
  ...candidate,
  evidence: getPolicyCandidateEvidenceCardPresentation(candidate.evidence_card),
})))
const sources = computed(() => candidates.value[0]?.evidence?.sources || [])
const detailsContainer = computed(() => props.detailsMode === 'inline' ? 'div' : 'details')
const headingId = computed(() => {
  const safeId = String(props.itemId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)
  return `library-evidence-profile-${safeId || 'item'}`
})

function sourceFor(candidate, sourceId) {
  return candidate.evidence?.sources.find((source) => source.id === sourceId) || {
    state_id: 'unavailable',
    message: 'No retained evidence is available.',
  }
}
</script>

<style scoped>
.library-evidence-profile {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #cbd5e1;
}

.library-evidence-profile > summary {
  width: fit-content;
  cursor: pointer;
  color: #bfdbfe;
}

.library-evidence-profile-content {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.library-evidence-profile-content h4,
.library-evidence-profile-content p {
  margin: 0;
}

.library-evidence-profile-content h4 {
  color: #e2e8f0;
  font-size: 0.75rem;
  font-weight: 600;
}

.library-evidence-profile-table-scroll {
  overflow-x: auto;
}

.library-evidence-profile table {
  width: 100%;
  min-width: 44rem;
  border-collapse: collapse;
  text-align: left;
}

.library-evidence-profile caption {
  padding-bottom: 0.5rem;
  text-align: left;
  color: #94a3b8;
}

.library-evidence-profile th,
.library-evidence-profile td {
  vertical-align: top;
  padding: 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.28);
}

.library-evidence-profile th {
  color: #e2e8f0;
  font-weight: 600;
}

.library-evidence-profile tbody th {
  min-width: 9rem;
}

.library-evidence-profile-rank,
.library-evidence-profile-secondary {
  display: block;
  color: #94a3b8;
  font-size: 0.6875rem;
  font-weight: 400;
}

.library-evidence-profile-state--supporting,
.library-evidence-profile-state--anchored {
  color: #bbf7d0;
}

.library-evidence-profile-state--contextual {
  color: #bfdbfe;
}

.library-evidence-profile-state--conflicting {
  color: #fecaca;
}

.library-evidence-profile-state--unavailable {
  color: #cbd5e1;
}
</style>
