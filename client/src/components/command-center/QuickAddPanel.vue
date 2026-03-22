<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section id="quick-add" class="secondary-section">
    <div class="secondary-section-header" @click="$emit('toggle')">
      <h2 class="secondary-section-title">Quick Add</h2>
      <span class="secondary-section-toggle">{{ expanded ? '−' : '+' }}</span>
    </div>
    <div v-if="expanded" class="secondary-section-content">
      <div class="quickadd-form">
        <input
          :value="query"
          type="text"
          class="quickadd-input"
          placeholder="Search TMDB..."
          :disabled="searching || submitting"
          @input="$emit('update:query', $event.target.value)"
          @keyup.enter="$emit('search')"
        />
        <Button
          variant="secondary"
          size="sm"
          :disabled="searching || submitting"
          :loading="searching"
          @click="$emit('search')"
        >
          Search
        </Button>
        <Button
          variant="primary"
          size="sm"
          :disabled="!selected || searching || submitting"
          :loading="submitting"
          @click="$emit('submit')"
        >
          Add
        </Button>
      </div>
      <p v-if="searching" class="quickadd-status">Searching TMDB...</p>
      <p v-if="errorMessage" class="quickadd-error">{{ errorMessage }}</p>
      <p v-if="successMessage" class="quickadd-success">{{ successMessage }}</p>
      <div v-if="selected" class="quickadd-selected">
        Selected: {{ selected.title }}
        <span v-if="selected.year">({{ selected.year }})</span>
        • {{ formatMediaType(selected.media_type) }}
      </div>
      <div v-if="results.length" class="quickadd-results">
        <button
          v-for="result in results"
          :key="`quick-add-${result.media_type}-${result.id}`"
          type="button"
          class="quickadd-result"
          :class="{ 'quickadd-result-selected': isSelected(result) }"
          :aria-pressed="isSelected(result) ? 'true' : 'false'"
          :disabled="searching || submitting"
          @click="$emit('select-result', result)"
        >
          <span class="quickadd-result-title">
            {{ result.title }}
            <span v-if="result.year" class="quickadd-result-year">({{ result.year }})</span>
          </span>
          <span class="quickadd-result-type">{{ formatMediaType(result.media_type) }}</span>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { Button } from '@/components/common'

const props = defineProps({
  errorMessage: {
    type: String,
    default: '',
  },
  expanded: {
    type: Boolean,
    default: false,
  },
  formatMediaType: {
    type: Function,
    required: true,
  },
  query: {
    type: String,
    default: '',
  },
  results: {
    type: Array,
    default: () => [],
  },
  searching: {
    type: Boolean,
    default: false,
  },
  selected: {
    type: Object,
    default: null,
  },
  submitting: {
    type: Boolean,
    default: false,
  },
  successMessage: {
    type: String,
    default: '',
  },
})

defineEmits(['toggle', 'update:query', 'search', 'submit', 'select-result'])

function isSelected(result) {
  return props.selected?.id === result?.id && props.selected?.media_type === result?.media_type
}
</script>

<style scoped>
.secondary-section {
  margin-bottom: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid #374151;
  background: #1f2937;
  overflow: hidden;
}

.secondary-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #111827;
  cursor: pointer;
  user-select: none;
}

.secondary-section-header:hover {
  background: #1a2332;
}

.secondary-section-title {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #9ca3af;
}

.secondary-section-toggle {
  font-size: 1rem;
  font-weight: 600;
  color: #6b7280;
  width: 1.25rem;
  text-align: center;
}

.secondary-section-content {
  padding: 1rem;
  border-top: 1px solid #374151;
}

.quickadd-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.quickadd-input {
  flex: 1;
  min-width: 200px;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #4b5563;
  background: #111827;
  color: #e5e7eb;
  font-size: 0.875rem;
}

.quickadd-input::placeholder {
  color: #6b7280;
}

.quickadd-error {
  margin-top: 0.75rem;
  font-size: 0.75rem;
  color: #f87171;
}

.quickadd-status {
  margin-top: 0.75rem;
  font-size: 0.75rem;
  color: #9ca3af;
}

.quickadd-success {
  margin-top: 0.75rem;
  font-size: 0.75rem;
  color: #22c55e;
}

.quickadd-selected {
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #1e40af;
  background: rgba(30, 64, 175, 0.1);
  font-size: 0.8125rem;
  color: #bfdbfe;
}

.quickadd-results {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.quickadd-result {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #374151;
  background: #111827;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.quickadd-result:hover {
  border-color: #1e40af;
  background: rgba(30, 64, 175, 0.1);
}

.quickadd-result-selected {
  border-color: #2563eb;
  background: rgba(37, 99, 235, 0.18);
}

.quickadd-result-title {
  font-size: 0.8125rem;
  color: #e5e7eb;
}

.quickadd-result-year {
  color: #6b7280;
}

.quickadd-result-type {
  font-size: 0.75rem;
  color: #6b7280;
}
</style>
