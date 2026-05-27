<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div
    class="suggestion-card"
    :class="[suggestion.status, typeClass]"
  >
    <div class="suggestion-header">
      <div class="suggestion-type">
        <span class="type-icon">{{ typeIcon }}</span>
        <span class="type-label">{{ typeLabel }}</span>
      </div>
      <div class="suggestion-meta">
        <span
          class="confidence"
          :class="confidenceClass"
        >
          {{ suggestion.confidence }}% confidence
        </span>
        <span class="impact">
          Est. impact: {{ suggestion.impact_estimate }}
        </span>
      </div>
    </div>
    
    <div class="suggestion-body">
      <h3>{{ suggestionTitle }}</h3>
      <p class="description">
        {{ suggestionDescription }}
      </p>
      
      <!-- Config preview -->
      <div class="config-preview">
        <code>{{ JSON.stringify(suggestion.suggestion_config, null, 2) }}</code>
      </div>
      
      <!-- Evidence count -->
      <div class="evidence">
        <span>📊 {{ suggestion.evidence_count || 0 }} supporting decisions</span>
      </div>
    </div>
    
    <div class="suggestion-footer">
      <span class="policy-name">{{ suggestion.policy_name }}</span>
      <span class="created-at">{{ formatDate(suggestion.created_at) }}</span>
    </div>
    
    <div
      v-if="suggestion.status === 'pending'"
      class="suggestion-actions"
    >
      <button
        class="btn btn-sm"
        @click="$emit('view-details', suggestion)"
      >
        View Details
      </button>
      <button
        class="btn btn-sm btn-success"
        @click="$emit('apply', suggestion)"
      >
        ✓ Apply
      </button>
      <button
        class="btn btn-sm btn-danger"
        @click="$emit('reject', suggestion)"
      >
        ✗ Reject
      </button>
    </div>
    
    <!-- Applied/Rejected status -->
    <div
      v-else
      class="suggestion-result"
    >
      <span
        v-if="suggestion.status === 'applied'"
        class="status applied"
      >
        ✓ Applied {{ formatDate(suggestion.applied_at) }}
      </span>
      <span
        v-else
        class="status rejected"
      >
        ✗ Rejected: {{ suggestion.rejection_reason }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  suggestion: {
    type: Object,
    required: true
  }
});

defineEmits(['view-details', 'apply', 'reject']);

const typeIcons = {
  'adjust_weight': '⚖️',
  'add_preset': '➕',
  'remove_preset': '➖',
  'modify_signal': '🔧',
  'adjust_threshold': '📊',
  'create_pattern': '🔗',
  'change_combination_mode': '🔀'
};

const typeLabels = {
  'adjust_weight': 'Adjust Weight',
  'add_preset': 'Add Preset',
  'remove_preset': 'Remove Preset',
  'modify_signal': 'Modify Signal',
  'adjust_threshold': 'Adjust Threshold',
  'create_pattern': 'Create Pattern',
  'change_combination_mode': 'Change Mode'
};

const typeIcon = computed(() => typeIcons[props.suggestion.suggestion_type] || '💡');
const typeLabel = computed(() => typeLabels[props.suggestion.suggestion_type] || props.suggestion.suggestion_type);
const typeClass = computed(() => `type-${props.suggestion.suggestion_type}`);

const confidenceClass = computed(() => {
  if (props.suggestion.confidence >= 80) return 'high';
  if (props.suggestion.confidence >= 60) return 'medium';
  return 'low';
});

const suggestionTitle = computed(() => {
  const config = props.suggestion.suggestion_config;
  switch (props.suggestion.suggestion_type) {
    case 'adjust_weight':
      return `Adjust ${config.signal} weight: ${config.current} → ${config.recommended}`;
    case 'add_preset':
      return `Add preset: ${config.preset_key}`;
    case 'remove_preset':
      return `Remove preset: ${config.preset_key}`;
    case 'adjust_threshold':
      return `Adjust ${config.threshold_type} threshold: ${config.current}% → ${config.recommended}%`;
    case 'create_pattern':
      return `Create pattern: ${config.pattern_type} "${config.pattern_value}"`;
    default:
      return props.suggestion.suggestion_type;
  }
});

const suggestionDescription = computed(() => {
  const config = props.suggestion.suggestion_config;
  return config.reason || 'Based on recent classification feedback';
});

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString();
}
</script>

<style scoped>
.suggestion-card {
  background: #2a2a3e;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  border-left: 4px solid #4a5568;
}

.suggestion-card.pending {
  border-left-color: #fbbf24;
}

.suggestion-card.applied {
  border-left-color: #10b981;
}

.suggestion-card.rejected {
  border-left-color: #ef4444;
}

.suggestion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.suggestion-type {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.type-icon {
  font-size: 1.5rem;
}

.type-label {
  font-weight: 600;
  color: #e5e7eb;
}

.suggestion-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
}

.confidence {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 500;
}

.confidence.high {
  background: #10b98150;
  color: #10b981;
}

.confidence.medium {
  background: #fbbf2450;
  color: #fbbf24;
}

.confidence.low {
  background: #ef444450;
  color: #ef4444;
}

.impact {
  color: #9ca3af;
}

.suggestion-body h3 {
  color: #e5e7eb;
  font-size: 1.125rem;
  margin-bottom: 0.5rem;
}

.description {
  color: #9ca3af;
  margin-bottom: 1rem;
}

.config-preview {
  background: #1a1a2e;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  overflow-x: auto;
}

.config-preview code {
  color: #a5b4fc;
  font-size: 0.875rem;
  font-family: 'Courier New', monospace;
  white-space: pre;
}

.evidence {
  color: #9ca3af;
  font-size: 0.875rem;
}

.suggestion-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #374151;
  font-size: 0.875rem;
  color: #9ca3af;
}

.suggestion-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
}

.btn:hover {
  opacity: 0.8;
}

.btn {
  background: #4b5563;
  color: #e5e7eb;
}

.btn-success {
  background: #10b981;
  color: white;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.suggestion-result {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #374151;
}

.status {
  font-weight: 500;
}

.status.applied {
  color: #10b981;
}

.status.rejected {
  color: #ef4444;
}
</style>
