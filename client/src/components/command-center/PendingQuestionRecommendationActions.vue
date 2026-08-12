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
      <p class="recommendation-label">
        {{ leadingDestination ? 'Leading candidate' : 'Current destination' }}
      </p>
      <p class="recommendation-destination">
        {{ primaryDestination.library_name }}
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
      <div
        v-if="decisionPresentation"
        class="decision-explanation"
      >
        <p class="decision-explanation-label">
          Why review is needed
        </p>
        <p class="recommendation-explanation">
          {{ decisionPresentation.deterministic.message }}
        </p>
        <div
          v-if="decisionPresentation.deterministic.safety_gate"
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
          v-if="decisionPresentation.deterministic.evidence.length"
          class="decision-evidence-list"
        >
          <li
            v-for="fact in decisionPresentation.deterministic.evidence"
            :key="fact.id"
          >
            {{ fact.label }}
          </li>
        </ul>
        <details
          v-if="decisionPresentation.deterministic.additional_safety_gates.length"
          class="additional-safety-gates"
        >
          <summary>Review additional routing safeguards</summary>
          <ul>
            <li
              v-for="gate in decisionPresentation.deterministic.additional_safety_gates"
              :key="gate.id"
            >
              <strong>{{ gate.label }}:</strong> {{ gate.message }}
            </li>
          </ul>
        </details>
        <div
          v-if="decisionPresentation.candidate_bound_verification"
          class="candidate-bound-verification"
          role="status"
        >
          <p class="candidate-bound-verification-label">
            Candidate-bound verification
          </p>
          <p class="candidate-bound-verification-title">
            {{ decisionPresentation.candidate_bound_verification.label }}
          </p>
          <p>
            {{ decisionPresentation.candidate_bound_verification.message }}
          </p>
        </div>
        <div
          v-else-if="decisionPresentation.ai_advisory"
          class="ai-advisory"
        >
          <p class="ai-advisory-label">
            {{ decisionPresentation.ai_advisory.status_id === 'aligned_with_deterministic'
              ? 'AI check'
              : 'AI advisory' }}
          </p>
          <p>
            {{ decisionPresentation.ai_advisory.message }}
          </p>
          <p v-if="decisionPresentation.ai_advisory.proposed_destination">
            Proposed destination: {{ decisionPresentation.ai_advisory.proposed_destination.library_name }}.
          </p>
        </div>
      </div>
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

.recommendation-destination {
  margin-top: 0.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #f3f4f6;
}

.recommendation-score,
.recommendation-explanation,
.resolution-scope {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: #cbd5e1;
}

.decision-explanation {
  display: grid;
  gap: 0.25rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(148, 163, 184, 0.35);
}

.decision-explanation-label {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: #e2e8f0;
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

.candidate-bound-verification-label,
.candidate-bound-verification-title {
  margin: 0;
}

.candidate-bound-verification-label {
  font-weight: 600;
  color: #bfdbfe;
}

.candidate-bound-verification-title {
  margin-top: 0.25rem;
  color: #e2e8f0;
}

.candidate-bound-verification p:last-child {
  margin-top: 0.25rem;
}

.route-safety-gate,
.additional-safety-gates {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #cbd5e1;
}

.route-safety-gate p,
.additional-safety-gates ul {
  margin-top: 0.25rem;
}

.route-safety-gate-label {
  margin: 0;
  font-weight: 600;
  color: #bfdbfe;
}

.additional-safety-gates summary {
  width: fit-content;
  cursor: pointer;
  color: #bfdbfe;
}

.additional-safety-gates ul {
  display: grid;
  gap: 0.25rem;
  padding-left: 1rem;
}

.ai-advisory p {
  margin-top: 0.5rem;
}

.ai-advisory-label {
  margin: 0;
  font-weight: 600;
  color: #bfdbfe;
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
