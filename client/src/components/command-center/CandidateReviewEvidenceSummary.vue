<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    v-if="presentation"
    class="candidate-review-evidence-summary"
    :class="`candidate-review-evidence-summary--${presentation.tone}`"
    :aria-labelledby="headingId"
    data-testid="candidate-review-evidence-summary"
  >
    <h4
      :id="headingId"
      class="candidate-review-evidence-summary-label"
    >
      What the system found
    </h4>
    <p class="candidate-review-evidence-summary-title">
      {{ presentation.label }}
    </p>
    <p class="candidate-review-evidence-summary-message">
      {{ presentation.message }}
    </p>

    <component
      :is="detailsContainer"
      v-if="hasDetails"
      class="candidate-review-evidence-details"
    >
      <summary v-if="detailsMode === 'disclosure'">
        Review evidence details
      </summary>
      <div class="candidate-review-evidence-details-content">
        <section v-if="presentation.sources.length">
          <h5>Checks used for this suggestion</h5>
          <ul>
            <li
              v-for="source in presentation.sources"
              :key="source.id"
            >
              <strong>{{ source.label }}:</strong> {{ source.message }}
            </li>
          </ul>
        </section>

        <section v-if="presentation.contrastive">
          <h5>Exact-item check across eligible libraries</h5>
          <p>
            <strong>{{ presentation.contrastive.detail_label }}:</strong>
            {{ presentation.contrastive.detail_message }}
          </p>
        </section>

        <section v-if="presentation.adjudication">
          <h5>AI comparison</h5>
          <p>
            <strong>{{ presentation.adjudication.label }}:</strong>
            {{ presentation.adjudication.message }}
          </p>
          <p v-if="presentation.adjudication.proposed_destination">
            Advisory destination: {{ presentation.adjudication.proposed_destination.library_name }}.
          </p>
          <p v-if="presentation.adjudication.semantic_retrieval">
            <strong>{{ presentation.adjudication.semantic_retrieval.label }}:</strong>
            {{ presentation.adjudication.semantic_retrieval.message }}
          </p>
        </section>
      </div>
    </component>
  </section>
</template>

<script setup>
import { computed } from 'vue'

import {
  getPolicyCandidateReviewEvidenceSummaryPresentation,
} from '@/utils/policyCandidateReviewEvidenceSummaryPresentation'

const props = defineProps({
  candidateEvidence: {
    type: Object,
    default: () => null,
  },
  contrastiveEvidence: {
    type: Object,
    default: () => null,
  },
  candidateAdjudication: {
    type: Object,
    default: () => null,
  },
  itemId: {
    type: [Number, String],
    required: true,
  },
  detailsMode: {
    type: String,
    default: 'disclosure',
    validator: value => ['disclosure', 'inline'].includes(value),
  },
})

const presentation = computed(() => getPolicyCandidateReviewEvidenceSummaryPresentation(
  props.candidateEvidence,
  props.contrastiveEvidence,
  props.candidateAdjudication,
))
const hasDetails = computed(() => Boolean(
  presentation.value?.sources.length
  || presentation.value?.contrastive
  || presentation.value?.adjudication,
))
const detailsContainer = computed(() => props.detailsMode === 'inline' ? 'div' : 'details')
const headingId = computed(() => {
  const safeId = String(props.itemId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)
  return `candidate-review-evidence-summary-${safeId || 'item'}`
})
</script>

<style scoped>
.candidate-review-evidence-summary {
  display: grid;
  gap: 0.25rem;
  margin-top: 0.5rem;
  padding: 0.5rem;
  border: 1px solid rgba(96, 165, 250, 0.45);
  border-radius: 0.375rem;
  background: rgba(30, 64, 175, 0.12);
  font-size: 0.75rem;
  color: #cbd5e1;
}

.candidate-review-evidence-summary--attention {
  border-color: rgba(251, 191, 36, 0.65);
  background: rgba(146, 64, 14, 0.12);
}

.candidate-review-evidence-summary--conflict {
  border-color: rgba(248, 113, 113, 0.72);
  background: rgba(127, 29, 29, 0.16);
}

.candidate-review-evidence-summary-label,
.candidate-review-evidence-summary-title,
.candidate-review-evidence-summary-message,
.candidate-review-evidence-details p,
.candidate-review-evidence-details ul,
.candidate-review-evidence-details h5 {
  margin: 0;
}

.candidate-review-evidence-summary-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #bfdbfe;
}

.candidate-review-evidence-summary-title {
  color: #e2e8f0;
  font-weight: 600;
}

.candidate-review-evidence-details {
  margin-top: 0.25rem;
}

.candidate-review-evidence-details > summary {
  width: fit-content;
  cursor: pointer;
  color: #bfdbfe;
}

.candidate-review-evidence-details-content {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.candidate-review-evidence-details-content section {
  display: grid;
  gap: 0.25rem;
}

.candidate-review-evidence-details h5 {
  color: #e2e8f0;
  font-size: 0.75rem;
  font-weight: 600;
}

.candidate-review-evidence-details ul {
  display: grid;
  gap: 0.25rem;
  padding-left: 1rem;
}
</style>
