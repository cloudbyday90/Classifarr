<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div v-if="items.length" class="action-queue">
    <article v-for="item in items" :key="item.id" class="action-item">
      <div class="action-item-header">
        <h3 class="action-item-title">
          {{ item.title }}
          <span v-if="item.year" class="action-item-year">({{ item.year }})</span>
        </h3>
      </div>
      <div class="action-item-meta">
        <span>{{ safePercent(item.confidence) }}% confidence</span>
        <span>{{ formatMediaType(item.media_type) }}</span>
        <span v-if="suggestedLibraryLabel(item)">→ {{ suggestedLibraryLabel(item) }}</span>
      </div>
      <p v-if="item.pending_reason" class="action-item-reason">{{ item.pending_reason }}</p>
      <p v-if="targetedRecheckLine(item)" class="action-item-diagnostic">{{ targetedRecheckLine(item) }}</p>

      <div v-if="policyQuestion(item)" class="action-item-question">
        <p class="question-text">{{ policyQuestion(item).question }}</p>
        <p v-if="policyQuestion(item).why_uncertain" class="question-why">{{ policyQuestion(item).why_uncertain }}</p>
        <p v-if="item.policy_question_stale" class="question-stale">
          This question may be outdated because policy or library settings changed after it was generated. Retry Classification to refresh it before confirming.
        </p>

        <div v-if="binaryPolicyOptions(item)" class="question-actions">
          <Button variant="success" size="sm" @click="emitResolveOption(item, binaryPolicyOptions(item).yes, 'Yes')">Yes</Button>
          <Button variant="error" size="sm" @click="emitResolveOption(item, binaryPolicyOptions(item).no, 'No')">No</Button>
          <Button variant="ghost" size="sm" @click="$emit('toggle-change-mode', item.id)">Change</Button>
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

        <div v-else class="question-actions">
          <Button
            v-if="primaryPolicyOption(item)"
            variant="success"
            size="sm"
            @click="emitResolveOption(item, primaryPolicyOption(item), 'Confirm')"
          >
            Confirm
          </Button>
          <Button variant="ghost" size="sm" @click="$emit('toggle-change-mode', item.id)">Change</Button>
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
      </div>

      <div v-else class="action-item-fallback">
        <p class="fallback-message">Policy question data unavailable. Use Change to resolve manually.</p>
        <Button variant="ghost" size="sm" @click="$emit('toggle-change-mode', item.id)">Change</Button>
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

      <div v-if="changeMode[item.id]" class="action-item-change">
        <select
          :value="manualLibraryValue(item.id)"
          class="change-select"
          @change="$emit('update-manual-library', { itemId: item.id, value: $event.target.value || null })"
        >
          <option value="">Choose library...</option>
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
          @click="$emit('resolve-manual', item)"
        >
          Resolve
        </Button>
      </div>

      <div v-if="!binaryPolicyOptions(item) && policyOptions(item).length > 0 && !changeMode[item.id]" class="action-item-options">
        <Button
          v-for="option in policyOptions(item)"
          :key="`${item.id}-${option.value || option.label}`"
          variant="primary"
          size="sm"
          @click="emitResolveOption(item, option)"
        >
          {{ option.label || option.value || 'Select' }}
        </Button>
      </div>
    </article>

    <div v-if="items.length > 1" class="action-queue-footer">
      <Button
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

  <div v-else class="action-idle">
    <div class="idle-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <p class="idle-title">All caught up</p>
    <p class="idle-subtitle">No items awaiting your decision</p>
  </div>
</template>

<script setup>
import { Button } from '@/components/common'
import {
  binaryPolicyOptions,
  policyOptions,
  policyQuestion,
  primaryPolicyOption,
  suggestedLibraryLabel,
  targetedRecheckLine,
} from '@/utils/needsAttention'

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
  'resolve-manual',
  'resolve-option',
  'retry-all',
  'retry-item',
  'toggle-change-mode',
  'update-manual-library',
])

function emitResolveOption(item, option, selectedOptionLabel = null) {
  emit('resolve-option', { item, option, selectedOptionLabel })
}

function manualLibraryValue(itemId) {
  return props.manualLibraryByItemId?.[itemId] ?? ''
}
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

.question-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
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
