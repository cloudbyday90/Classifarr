<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section class="pending-question-actions">
    <div
      v-if="primaryDestination"
      class="leading-recommendation"
    >
      <p
        v-if="!decisionPresentation"
        class="recommendation-label"
      >
        {{ leadingDestination ? 'Leading candidate' : 'Current destination' }}
      </p>
      <p class="recommendation-score">
        <template v-if="leadingDestination">
          {{ deterministicScoreLabel }}
        </template>
        <template v-else>
          {{ answer?.question?.why_uncertain || 'The runtime decision requires a bounded operator outcome.' }}
        </template>
      </p>
      <p
        v-if="!decisionPresentation"
        class="recommendation-explanation"
      >
        {{ leadingDestination
          ? recommendation.why_not_automatic.message
          : 'This resolves this item only and does not change future policy learning.' }}
      </p>
      <PendingQuestionReviewSummary
        v-if="decisionPresentation"
        :item-id="itemId"
        :presentation="reviewSummaryPresentation"
      />
      <details
        v-if="decisionPresentation"
        class="review-evidence-and-safeguards"
      >
        <summary>Review policy evidence and safeguards</summary>
        <div class="review-evidence-and-safeguards-content">
          <section :aria-labelledby="`policy-decision-details-${itemId}`">
            <h4 :id="`policy-decision-details-${itemId}`">
              Policy decision details
            </h4>
            <p>{{ decisionPresentation.deterministic.message }}</p>
            <div
              v-if="showSafetyGate"
              class="route-safety-gate"
            >
              <p class="route-safety-gate-label">
                Routing safeguard
              </p>
              <p>
                {{ decisionPresentation.deterministic.safety_gate.message }}
              </p>
            </div>
            <ul
              v-if="!candidateReviewEvidenceSummary && decisionPresentation.deterministic.evidence.length"
              class="decision-evidence-list"
            >
              <li
                v-for="fact in decisionPresentation.deterministic.evidence"
                :key="fact.id"
              >
                {{ fact.label }}
              </li>
            </ul>
          </section>
          <CandidateReviewEvidenceSummary
            :candidate-evidence="candidateEvidenceCard"
            :contrastive-evidence="candidateContrastiveEvidence"
            :candidate-adjudication="decisionPresentation.candidate_adjudication"
            details-mode="inline"
            :item-id="itemId"
          />
          <LibraryEvidenceProfile
            details-mode="inline"
            :item-id="itemId"
            :value="libraryEvidenceProfile"
          />
          <section
            v-if="scoreExplanation"
            class="score-explanation"
            :aria-labelledby="`policy-score-explanation-${itemId}`"
          >
            <h4 :id="`policy-score-explanation-${itemId}`">
              How this policy score was calculated
            </h4>
            <p>
              {{ scoreExplanationThresholdMessage }}
            </p>
            <p>
              This is a deterministic policy-evidence score, not a probability or AI decision. It cannot bypass the routing safeguards above.
            </p>
            <p class="score-explanation-label">
              Evidence contribution
            </p>
            <ul>
              <li
                v-for="component in scoreExplanation.components"
                :key="component.source_id"
              >
                <strong>{{ scoreExplanationSourceLabel(component.source_id) }}:</strong>
                {{ component.evidence_score }}/100 evidence score; contributes {{ formatScoreValue(component.weighted_contribution) }} points ({{ formatScoreValue(component.normalized_weight_percent) }}% of active evidence).
              </li>
            </ul>
            <p>
              Weighted base score: {{ formatScoreValue(scoreExplanation.base_score) }}/100.
            </p>
            <p v-if="scoreExplanation.agreement_multiplier_percent > 100">
              {{ scoreExplanation.components.length }} corroborating sources applied a {{ scoreExplanation.agreement_multiplier_percent - 100 }}% agreement adjustment before evidence-safety calibration.
            </p>
            <p>
              {{ scoreExplanationCalibrationMessage }}
              <template v-if="scoreExplanation.calibration.pre_safety_score !== null">
                It changed the pre-safety score from {{ scoreExplanation.calibration.pre_safety_score }} to {{ scoreExplanation.score }}.
              </template>
            </p>
          </section>
          <section
            v-if="decisionPresentation.deterministic.additional_safety_gates.length"
            class="additional-safety-gates"
            :aria-labelledby="`additional-routing-safeguards-${itemId}`"
          >
            <h4 :id="`additional-routing-safeguards-${itemId}`">
              Additional routing safeguards
            </h4>
            <ul>
              <li
                v-for="gate in decisionPresentation.deterministic.additional_safety_gates"
                :key="gate.id"
              >
                <strong>{{ gate.label }}:</strong> {{ gate.message }}
              </li>
            </ul>
          </section>
          <section
            v-if="decisionPresentation.candidate_bound_verification"
            class="candidate-bound-verification"
            :aria-labelledby="`candidate-bound-verification-${itemId}`"
          >
            <h4 :id="`candidate-bound-verification-${itemId}`">
              Candidate-bound verification
            </h4>
            <p class="candidate-bound-verification-title">
              {{ decisionPresentation.candidate_bound_verification.label }}
            </p>
            <p>
              {{ decisionPresentation.candidate_bound_verification.message }}
            </p>
          </section>
          <section
            v-else-if="decisionPresentation.ai_advisory && !decisionPresentation.candidate_adjudication"
            class="ai-advisory"
            :aria-labelledby="`ai-advisory-${itemId}`"
          >
            <h4 :id="`ai-advisory-${itemId}`">
              {{ decisionPresentation.ai_advisory.status_id === 'aligned_with_deterministic'
                ? 'AI check'
                : 'AI advisory' }}
            </h4>
            <p>
              {{ decisionPresentation.ai_advisory.message }}
            </p>
            <p v-if="decisionPresentation.ai_advisory.proposed_destination">
              Proposed destination: {{ decisionPresentation.ai_advisory.proposed_destination.library_name }}.
            </p>
          </section>
        </div>
      </details>
      <Button
        v-if="canConfirmDestination"
        variant="success"
        size="sm"
        :disabled="isResolving"
        :loading="isResolving"
        @click="emitConfirmDestination(primaryDestination)"
      >
        Confirm {{ primaryDestination.library_name }}
      </Button>
    </div>

    <div
      v-else
      class="manual-destination"
    >
      <p class="recommendation-label">
        Manual destination decision
      </p>
      <p class="recommendation-explanation">
        {{ recommendation?.why_not_automatic?.message || 'No single destination has enough evidence to lead this decision.' }}
      </p>
    </div>

    <details
      v-if="alternativeDestinations.length"
      class="alternative-destinations"
    >
      <summary>
        {{ alternativeReviewLabel }}
      </summary>
      <div class="alternative-actions">
        <Button
          v-for="destination in alternativeDestinations"
          :key="`alternative-${destination.library_id}`"
          variant="secondary"
          size="sm"
          :disabled="isResolving || !canConfirmDestination"
          :loading="isResolving"
          @click="emitConfirmDestination(destination)"
        >
          {{ leadingDestination ? `Use ${destination.library_name} instead` : `Use ${destination.library_name}` }}
        </Button>
      </div>
    </details>

    <div class="secondary-actions">
      <Button
        v-if="canChangeDestination"
        variant="ghost"
        size="sm"
        @click="$emit('choose-destination')"
      >
        {{ primaryDestination ? 'Choose a different destination' : 'Choose destination' }}
      </Button>
      <Button
        variant="warning"
        size="sm"
        :disabled="isRetrying"
        :loading="isRetrying"
        @click="$emit('retry')"
      >
        Retry Classification
      </Button>
    </div>

    <p class="resolution-scope">
      This resolves this item only. It does not change future policy learning.
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue'

import { Button } from '@/components/common'
import {
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS,
  availablePolicyQuestionAnswerAction,
} from '@/utils/policyQuestionAnswerContract'
import {
  policyQuestionRecommendation,
  policyQuestionCandidateDestinations,
} from '@/utils/policyQuestionRecommendationPresentation'
import {
  policyQuestionDecisionPresentation,
} from '@/utils/policyQuestionDecisionPresentation'
import {
  getPolicyCandidateEvidenceCardPresentation,
} from '@/utils/policyCandidateEvidenceCardPresentation'
import {
  getPolicyCandidateContrastiveEvidencePresentation,
} from '@/utils/policyCandidateContrastiveEvidencePresentation'
import {
  getPolicyCandidateReviewEvidenceSummaryPresentation,
} from '@/utils/policyCandidateReviewEvidenceSummaryPresentation'
import {
  getPendingQuestionReviewSummaryPresentation,
} from '@/utils/pendingQuestionReviewSummaryPresentation'
import CandidateReviewEvidenceSummary from './CandidateReviewEvidenceSummary.vue'
import LibraryEvidenceProfile from './LibraryEvidenceProfile.vue'
import PendingQuestionReviewSummary from './PendingQuestionReviewSummary.vue'

const props = defineProps({
  answer: {
    type: Object,
    required: true,
  },
  isActionBusy: {
    type: Function,
    required: true,
  },
  itemId: {
    type: [Number, String],
    required: true,
  },
})

const emit = defineEmits([
  'choose-destination',
  'confirm-destination',
  'retry',
])

const recommendation = computed(() => policyQuestionRecommendation(props.answer))
const decisionPresentation = computed(() => policyQuestionDecisionPresentation(props.answer))
const scoreExplanation = computed(() => (
  decisionPresentation.value?.deterministic?.score_explanation || null
))
const candidateEvidenceCard = computed(() => getPolicyCandidateEvidenceCardPresentation(
  decisionPresentation.value?.deterministic?.candidate_evidence_card,
))
const candidateContrastiveEvidence = computed(() => getPolicyCandidateContrastiveEvidencePresentation(
  decisionPresentation.value?.deterministic?.candidate_contrastive_evidence,
))
const candidateReviewEvidenceSummary = computed(() => getPolicyCandidateReviewEvidenceSummaryPresentation(
  candidateEvidenceCard.value,
  candidateContrastiveEvidence.value,
  decisionPresentation.value?.candidate_adjudication,
))
const libraryEvidenceProfile = computed(() => (
  decisionPresentation.value?.deterministic?.library_evidence_profile || null
))
const leadingDestination = computed(() => recommendation.value?.leading_destination || null)
const candidateDestinations = computed(() => policyQuestionCandidateDestinations(props.answer))
const isNativeQuestion = computed(() => props.answer?.question?.type === 'native_runtime_question')
const primaryDestination = computed(() => {
  if (leadingDestination.value) return leadingDestination.value
  return isNativeQuestion.value && candidateDestinations.value.length === 1
    ? candidateDestinations.value[0]
    : null
})
const canConfirmDestination = computed(() => Boolean(availablePolicyQuestionAnswerAction(
  props.answer,
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION,
)))
const canChangeDestination = computed(() => Boolean(availablePolicyQuestionAnswerAction(
  props.answer,
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CHANGE_DESTINATION,
)))
const reviewSummaryPresentation = computed(() => getPendingQuestionReviewSummaryPresentation({
  destination: primaryDestination.value,
  canConfirmDestination: canConfirmDestination.value,
  canChangeDestination: canChangeDestination.value,
}))
const isResolving = computed(() => props.isActionBusy(`resolve-${props.itemId}`))
const isRetrying = computed(() => props.isActionBusy(`retry-classification-${props.itemId}`))
const alternativeDestinations = computed(() => {
  return candidateDestinations.value
    .filter(destination => destination?.library_id !== primaryDestination.value?.library_id)
})
const alternativeReviewLabel = computed(() => {
  const count = alternativeDestinations.value.length
  if (leadingDestination.value) {
    return `Review ${count} ${count === 1 ? 'alternative candidate' : 'alternative candidates'}`
  }
  return `Review ${count} ${count === 1 ? 'candidate destination' : 'candidate destinations'}`
})
const deterministicScoreLabel = computed(() => {
  const deterministic = decisionPresentation.value?.deterministic
  if (deterministic?.score === null || deterministic?.score === undefined) {
    return `Evidence score: ${leadingDestination.value?.evidence_score}/100`
  }

  const thresholds = []
  if (deterministic.review_threshold !== null && deterministic.review_threshold !== undefined) {
    thresholds.push(`confirmation at ${deterministic.review_threshold}`)
  }
  if (deterministic.automatic_threshold !== null && deterministic.automatic_threshold !== undefined) {
    thresholds.push(`automatic at ${deterministic.automatic_threshold}`)
  }

  return thresholds.length
    ? `Policy score: ${deterministic.score}/100 (${thresholds.join(', ')})`
    : `Policy score: ${deterministic.score}/100`
})
const showSafetyGate = computed(() => {
  const safetyGate = decisionPresentation.value?.deterministic?.safety_gate
  return Boolean(safetyGate?.message && safetyGate.message !== decisionPresentation.value?.deterministic?.message)
})
const scoreExplanationThresholdMessage = computed(() => {
  const explanation = scoreExplanation.value
  const deterministic = decisionPresentation.value?.deterministic
  if (!explanation) return ''

  const score = explanation.score
  const reviewThreshold = deterministic?.review_threshold
  const automaticThreshold = deterministic?.automatic_threshold
  if (automaticThreshold !== null && automaticThreshold !== undefined && score >= automaticThreshold) {
    return `The score meets the automatic threshold of ${automaticThreshold}, but another routing safeguard still requires review.`
  }
  if (reviewThreshold !== null && reviewThreshold !== undefined && score >= reviewThreshold &&
      automaticThreshold !== null && automaticThreshold !== undefined) {
    return `The score is ${score - reviewThreshold} points above confirmation and ${automaticThreshold - score} points below automatic routing.`
  }
  if (reviewThreshold !== null && reviewThreshold !== undefined) {
    return `The score is ${reviewThreshold - score} points below the confirmation threshold of ${reviewThreshold}.`
  }
  return `The displayed policy score is ${score}/100.`
})
const scoreExplanationCalibrationMessage = computed(() => {
  const statusId = scoreExplanation.value?.calibration?.status_id
  const messages = {
    not_adjusted: 'No evidence-safety calibration changed this score.',
    negative_conflict: 'An evidence-safety calibration was applied because deterministic evidence conflicted.',
    compatibility_only: 'An evidence-safety calibration was applied because only compatibility evidence was available.',
    broad_compatibility_overlap: 'An evidence-safety calibration was applied because declared compatibility evidence overlapped another destination.',
    insufficient_specialized_evidence: 'An evidence-safety calibration was applied because no specialized declared evidence was available.',
    profile_only: 'An evidence-safety calibration was applied because only observed library contents supported the candidate.',
    rag_only: 'An evidence-safety calibration was applied because only similar-item retrieval supported the candidate.',
    no_positive_evidence: 'An evidence-safety calibration was applied because no positive policy evidence was available.',
    evidence_safety_adjusted: 'An evidence-safety calibration was applied before this score was displayed.',
  }
  return messages[statusId] || 'No additional calibration information is available.'
})

function scoreExplanationSourceLabel(sourceId) {
  const labels = {
    declared_policy_signal: 'Declared policy signal',
    declared_policy_intent: 'Declared policy intent',
    observed_library_contents: 'Observed library contents',
    confirmed_pattern: 'Confirmed classification pattern',
    similar_items: 'Similar items (RAG)',
    prior_outcomes: 'Prior confirmed outcomes',
  }
  return labels[sourceId] || 'Deterministic policy evidence'
}

function formatScoreValue(value) {
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(1)
}

function emitConfirmDestination(destination) {
  emit('confirm-destination', {
    actionId: POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION,
    destinationLibraryId: destination.library_id,
  })
}
</script>

<style scoped>
.pending-question-actions {
  display: grid;
  gap: 0.75rem;
}

.leading-recommendation,
.manual-destination {
  padding: 0.75rem;
  border: 1px solid #2563eb;
  border-radius: 0.375rem;
  background: rgba(30, 64, 175, 0.12);
}

.manual-destination {
  border-color: #4b5563;
  background: rgba(55, 65, 81, 0.2);
}

.recommendation-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #bfdbfe;
}

.recommendation-score,
.recommendation-explanation,
.resolution-scope {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: #cbd5e1;
}

.review-evidence-and-safeguards {
  margin-top: 0.75rem;
  font-size: 0.75rem;
  color: #cbd5e1;
}

.review-evidence-and-safeguards > summary {
  width: fit-content;
  cursor: pointer;
  color: #bfdbfe;
}

.review-evidence-and-safeguards-content {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.review-evidence-and-safeguards-content > section > h4 {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: #bfdbfe;
}

.review-evidence-and-safeguards-content > section > p {
  margin-top: 0.25rem;
}

.decision-evidence-list {
  display: grid;
  gap: 0.25rem;
  margin: 0.25rem 0 0;
  padding-left: 1rem;
  font-size: 0.75rem;
  color: #cbd5e1;
}

.ai-advisory {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #cbd5e1;
}

.candidate-bound-verification {
  margin-top: 0.5rem;
  padding: 0.5rem;
  border: 1px solid rgba(96, 165, 250, 0.45);
  border-radius: 0.375rem;
  background: rgba(30, 64, 175, 0.12);
  font-size: 0.75rem;
  color: #cbd5e1;
}

.candidate-bound-verification-title {
  margin: 0;
  color: #e2e8f0;
  font-weight: 600;
}

.candidate-bound-verification p:last-child {
  margin-top: 0.25rem;
}

.route-safety-gate,
.additional-safety-gates,
.score-explanation {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #cbd5e1;
}

.route-safety-gate p,
.additional-safety-gates ul,
.score-explanation p,
.score-explanation ul {
  margin-top: 0.25rem;
}

.route-safety-gate-label {
  margin: 0;
  font-weight: 600;
  color: #bfdbfe;
}

.additional-safety-gates ul,
.score-explanation ul {
  display: grid;
  gap: 0.25rem;
  padding-left: 1rem;
}

.score-explanation-label {
  font-weight: 600;
  color: #bfdbfe;
}

.ai-advisory p {
  margin-top: 0.5rem;
}

.leading-recommendation :deep(.btn) {
  margin-top: 0.75rem;
}

.alternative-destinations {
  font-size: 0.75rem;
  color: #cbd5e1;
}

.alternative-destinations summary {
  width: fit-content;
  cursor: pointer;
  color: #bfdbfe;
}

.alternative-actions,
.secondary-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.alternative-actions {
  margin-top: 0.75rem;
}

.resolution-scope {
  color: #94a3b8;
}
</style>
