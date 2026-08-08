<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div
    v-if="items.length"
    class="action-queue"
  >
    <article
      v-for="item in items"
      :key="item.id"
      class="action-item"
    >
      <div class="action-item-header">
        <h3 class="action-item-title">
          {{ item.title }}
          <span
            v-if="item.year"
            class="action-item-year"
          >({{ item.year }})</span>
        </h3>
      </div>
      <div class="action-item-meta">
        <span>{{ safePercent(item.confidence) }}% confidence</span>
        <span>{{ formatMediaType(item.media_type) }}</span>
        <span v-if="suggestedLibraryLabel(item)">→ {{ suggestedLibraryLabel(item) }}</span>
      </div>
      <p
        v-if="needsAttentionReason(item)"
        class="action-item-reason"
      >
        {{ needsAttentionReason(item) }}
      </p>
      <p
        v-if="targetedRecheckLine(item)"
        class="action-item-diagnostic"
      >
        {{ targetedRecheckLine(item) }}
      </p>

      <div
        v-if="answerContract(item) || policyQuestion(item)"
        class="action-item-question"
      >
        <p class="question-text">
          {{ questionText(item) }}
        </p>
        <p
          v-if="questionExplanation(item)"
          class="question-why"
        >
          {{ questionExplanation(item) }}
        </p>
        <p
          v-if="item.policy_question_stale"
          class="question-stale"
        >
          This question may be outdated because policy or library settings changed after it was generated. Retry Classification to refresh it before confirming.
        </p>

        <div
          v-if="item.policy_question_stale || !answerContract(item)"
          class="native-pending-question-invalid"
          role="status"
        >
          <p>
            This question must be refreshed before it can be resolved. Retry Classification to rebuild it from the current policy state.
          </p>
          <Button
            variant="warning"
            size="sm"
            :disabled="isActionBusy(`retry-classification-${item.id}`)"
            :loading="isActionBusy(`retry-classification-${item.id}`)"
            @click="$emit('retry-item', item)"
          >
            Retry Classification
          </Button>
        </div>

        <PendingQuestionRecommendationActions
          v-else
          :answer="answerContract(item)"
          :is-action-busy="isActionBusy"
          :item-id="item.id"
          @choose-destination="$emit('toggle-change-mode', item.id)"
          @confirm-destination="emitResolveOption(item, $event.actionId, $event.destinationLibraryId)"
          @retry="$emit('retry-item', item)"
        />
      </div>

      <div
        v-else-if="isQueuedForRetry(item)"
        class="action-item-retry"
      >
        <p class="retry-message">
          This item could not be classified because the AI was temporarily unavailable. Retry now that the issue is resolved.
        </p>
        <Button
          variant="warning"
          size="sm"
          :disabled="isActionBusy(`retry-classification-${item.id}`)"
          :loading="isActionBusy(`retry-classification-${item.id}`)"
          @click="$emit('retry-item', item)"
        >
          Retry Classification
        </Button>
      </div>

      <div
        v-else
        class="action-item-fallback"
      >
        <p class="fallback-message">
          Policy question data is unavailable or no longer current. Retry Classification to rebuild the server-owned question before resolving it.
        </p>
        <Button
          variant="warning"
          size="sm"
          :disabled="isActionBusy(`retry-classification-${item.id}`)"
          :loading="isActionBusy(`retry-classification-${item.id}`)"
          @click="$emit('retry-item', item)"
        >
          Retry Classification
        </Button>
      </div>

      <div
        v-if="!item.policy_question_stale && answerContract(item) && changeMode[item.id]"
        class="action-item-change"
      >
        <select
          :value="manualLibraryValue(item.id)"
          class="change-select"
          @change="$emit('update-manual-library', { itemId: item.id, value: $event.target.value || null })"
        >
          <option value="">
            Choose library...
          </option>
          <option
            v-for="library in librariesForMediaType(item.media_type)"
            :key="`${item.id}-lib-${library.id}`"
            :value="library.id"
          >
            {{ library.name }}
          </option>
        </select>
        <Button
          variant="success"
          size="sm"
          :disabled="!manualLibraryValue(item.id)"
          @click="emitResolveOption(item, changeDestinationActionId, manualLibraryValue(item.id))"
        >
          Resolve
        </Button>
        <Button
          v-if="canResolveWithoutRouting(item)"
          variant="secondary"
          size="sm"
          :disabled="!manualLibraryValue(item.id)"
          @click="emitResolveOption(item, routeNotApplicableActionId, manualLibraryValue(item.id))"
        >
          Resolve without routing
        </Button>
      </div>
    </article>

    <div
      v-if="items.length > 1"
      class="action-queue-footer"
    >
      <Button
        v-if="hasBulkConfirmableItems"
        variant="secondary"
        size="sm"
        :disabled="isActionBusy('confirm-all')"
        :loading="isActionBusy('confirm-all')"
        @click="$emit('confirm-all')"
      >
        Confirm All
      </Button>
      <Button
        variant="warning"
        size="sm"
        :disabled="isActionBusy('retry-all-classifications')"
        :loading="isActionBusy('retry-all-classifications')"
        @click="$emit('retry-all')"
      >
        Retry Classification All
      </Button>
    </div>
  </div>

  <div
    v-else
    class="action-idle"
  >
    <div class="idle-icon">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    </div>
    <p class="idle-title">
      All caught up
    </p>
    <p class="idle-subtitle">
      No items awaiting your decision
    </p>
  </div>
</template>

<script setup>
import { Button } from '@/components/common'
import PendingQuestionRecommendationActions from './PendingQuestionRecommendationActions.vue'
import { computed } from 'vue'
import {
  isQueuedForRetry,
  policyQuestion,
  primaryNeedsAttentionReason,
  suggestedLibraryLabel,
  targetedRecheckLine,
} from '@/utils/needsAttention'
import {
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS,
  availablePolicyQuestionAnswerAction,
  policyQuestionAnswer,
} from '@/utils/policyQuestionAnswerContract'
import {
  leadingPolicyQuestionDestination,
} from '@/utils/policyQuestionRecommendationPresentation'
import {
  policyQuestionDecisionPresentation,
} from '@/utils/policyQuestionDecisionPresentation'

const props = defineProps({
  changeMode: {
    type: Object,
    required: true,
  },
  formatMediaType: {
    type: Function,
    required: true,
  },
  isActionBusy: {
    type: Function,
    required: true,
  },
  items: {
    type: Array,
    default: () => [],
  },
  librariesForMediaType: {
    type: Function,
    required: true,
  },
  manualLibraryByItemId: {
    type: Object,
    required: true,
  },
  safePercent: {
    type: Function,
    required: true,
  },
})

const emit = defineEmits([
  'confirm-all',
  'resolve-option',
  'retry-all',
  'retry-item',
  'toggle-change-mode',
  'update-manual-library',
])

const changeDestinationActionId = POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CHANGE_DESTINATION
const routeNotApplicableActionId = POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.ROUTE_NOT_APPLICABLE

function answerContract(item) {
  return policyQuestionAnswer(item)
}

function decisionPresentation(item) {
  return policyQuestionDecisionPresentation(answerContract(item))
}

function needsAttentionReason(item) {
  const presentation = decisionPresentation(item)
  if (presentation?.deterministic?.status_id === 'confirmation_required') {
    return 'Policy confirmation required'
  }

  return primaryNeedsAttentionReason(item)
}

function questionExplanation(item) {
  return decisionPresentation(item)?.deterministic?.message ||
    answerContract(item)?.question?.why_uncertain ||
    null
}

function questionText(item) {
  const deterministic = decisionPresentation(item)?.deterministic
  if (deterministic?.status_id === 'confirmation_required' && deterministic.destination?.library_name) {
    return `Confirm ${deterministic.destination.library_name} or choose a different destination.`
  }

  return answerContract(item)?.question?.text ||
    'This policy question needs to be refreshed before it can be resolved.'
}

function canResolveWithoutRouting(item) {
  return Boolean(availablePolicyQuestionAnswerAction(
    answerContract(item),
    routeNotApplicableActionId,
  ))
}

function emitResolveOption(item, actionId, destinationLibraryId) {
  emit('resolve-option', {
    item,
    answerSelection: {
      actionId,
      destinationLibraryId: Number(destinationLibraryId),
    },
  })
}

function manualLibraryValue(itemId) {
  return props.manualLibraryByItemId?.[itemId] ?? ''
}

const hasBulkConfirmableItems = computed(() => props.items.some(
  item => Boolean(leadingPolicyQuestionDestination(answerContract(item))) && Boolean(
    availablePolicyQuestionAnswerAction(
      answerContract(item),
      POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION,
    ),
  ),
))
</script>

<style scoped>
.action-queue {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.action-item {
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid #374151;
  background: #111827;
}

.action-item-header {
  margin-bottom: 0.5rem;
}

.action-item-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #f3f4f6;
}

.action-item-year {
  font-weight: 400;
  color: #6b7280;
}

.action-item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.action-item-reason {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.action-item-diagnostic {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #818cf8;
}

.action-item-question {
  margin-top: 1rem;
}

.question-text {
  font-size: 0.875rem;
  color: #e5e7eb;
  margin-bottom: 0.25rem;
}

.question-why {
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.75rem;
}

.question-stale {
  font-size: 0.75rem;
  color: #fbbf24;
  background: rgba(146, 64, 14, 0.12);
  border: 1px solid #92400e;
  border-radius: 0.375rem;
  padding: 0.5rem;
  margin-bottom: 0.75rem;
}

.native-pending-question-invalid {
  margin-top: 0.75rem;
  padding: 0.75rem;
  border: 1px solid #92400e;
  border-radius: 0.375rem;
  background: rgba(146, 64, 14, 0.12);
  color: #fef3c7;
  font-size: 0.75rem;
}

.native-pending-question-invalid p {
  margin-bottom: 0.75rem;
}

.action-item-fallback {
  margin-top: 1rem;
}

.fallback-message {
  font-size: 0.75rem;
  color: #fbbf24;
  background: rgba(146, 64, 14, 0.1);
  border: 1px solid #92400e;
  border-radius: 0.375rem;
  padding: 0.5rem;
  margin-bottom: 0.75rem;
}

.action-item-retry {
  margin-top: 1rem;
}

.retry-message {
  font-size: 0.75rem;
  color: #fbbf24;
  background: rgba(146, 64, 14, 0.1);
  border: 1px solid #92400e;
  border-radius: 0.375rem;
  padding: 0.5rem;
  margin-bottom: 0.75rem;
}

.action-item-change {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #374151;
  background: #1f2937;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.change-select {
  flex: 1;
  min-width: 150px;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #4b5563;
  background: #111827;
  color: #e5e7eb;
  font-size: 0.75rem;
}

.action-item-options {
  margin-top: 0.75rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.action-queue-footer {
  margin-top: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid #374151;
}

.action-idle {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  text-align: center;
}

.idle-icon {
  width: 56px;
  height: 56px;
  color: #22c55e;
  margin-bottom: 1rem;
}

.idle-title {
  font-size: 1rem;
  font-weight: 600;
  color: #e5e7eb;
  margin-bottom: 0.25rem;
}

.idle-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
}
</style>
