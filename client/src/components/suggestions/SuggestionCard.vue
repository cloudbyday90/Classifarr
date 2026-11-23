<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <article class="space-y-3 rounded-lg border border-gray-700 bg-background-light p-4">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div class="min-w-0 wrap-anywhere">
        <h2
          :id="titleId"
          class="font-semibold capitalize"
        >
          {{ typeLabel }} · {{ suggestion.policy_name }}
        </h2>
        <p
          v-if="suggestion.library_name"
          class="text-sm text-gray-300"
        >
          {{ suggestion.library_name }}
        </p>
      </div>
      <p class="text-sm text-gray-300">
        {{ statusLabel }}
      </p>
    </div>
    <p
      v-if="suggestion.impact_estimate"
      class="text-sm text-gray-300 wrap-anywhere"
    >
      {{ suggestion.impact_estimate }}
    </p>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm text-gray-300">
        {{ confidenceLabel }}
        <span v-if="suggestion.created_at"> · {{ formatDate(suggestion.created_at) }}</span>
      </p>
      <Button
        variant="outline-solid"
        size="sm"
        :aria-describedby="titleId"
        class="focus-visible:outline-2 focus-visible:outline-primary"
        @click="event => $emit('view-details', suggestion, event)"
      >
        View Details
      </Button>
    </div>
  </article>
</template>

<script setup>
import { computed, useId } from 'vue'
import Button from '@/components/common/Button.vue'

const props = defineProps({
  suggestion: { type: Object, required: true },
})
defineEmits(['view-details'])

const titleId = `suggestion-title-${useId()}`
const typeLabel = computed(() => props.suggestion.suggestion_type?.replaceAll('_', ' ') || 'Suggestion')
const confidenceLabel = computed(() => Number.isFinite(props.suggestion.confidence)
  ? `${props.suggestion.confidence}% confidence`
  : 'Confidence unavailable')

function formatDate(date) {
  return date ? new Date(date).toLocaleDateString() : ''
}

const statusLabel = computed(() => {
  const suggestion = props.suggestion
  switch (suggestion.status) {
    case 'pending': return 'Pending'
    case 'applied': return `Applied ${formatDate(suggestion.applied_at)}`.trim()
    case 'rejected': return 'Rejected'
    case 'superseded': return `Superseded after evidence changed ${formatDate(suggestion.superseded_at)}`.trim()
    default: return 'Review unavailable'
  }
})
</script>
