<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <Modal
    :model-value="true"
    title="Suggestion Details"
    :fallback-focus-target="fallbackFocusTarget"
    @update:model-value="$emit('close')"
  >
    <div class="space-y-5">
      <section
        aria-label="Proposed change"
        class="space-y-3"
      >
        <h4 class="font-semibold">
          Proposed Change
        </h4>
        <pre class="whitespace-pre-wrap wrap-anywhere rounded bg-background p-3 text-sm">{{ JSON.stringify(suggestion.suggestion_config, null, 2) }}</pre>
        <dl class="grid gap-3 sm:grid-cols-3">
          <div>
            <dt class="text-sm text-gray-300">
              Suggestion type
            </dt>
            <dd class="capitalize">
              {{ suggestion.suggestion_type?.replaceAll('_', ' ') }}
            </dd>
          </div>
          <div>
            <dt class="text-sm text-gray-300">
              Confidence
            </dt>
            <dd>{{ suggestion.confidence }}%</dd>
          </div>
          <div>
            <dt class="text-sm text-gray-300">
              Expected impact
            </dt>
            <dd>{{ suggestion.impact_estimate }}</dd>
          </div>
        </dl>
      </section>
      <SuggestionEvidencePages
        :key="suggestion.id"
        :suggestion-id="suggestion.id"
      />
    </div>
    <template
      v-if="suggestion.status === 'pending'"
      #footer
    >
      <Button
        variant="secondary"
        @click="$emit('reject', suggestion)"
      >
        Reject
      </Button>
      <Button
        variant="success"
        @click="$emit('apply', suggestion)"
      >
        Apply Suggestion
      </Button>
    </template>
  </Modal>
</template>

<script setup>
import Button from '@/components/common/Button.vue'
import Modal from '@/components/common/Modal.vue'
import SuggestionEvidencePages from './SuggestionEvidencePages.vue'

defineProps({
  suggestion: { type: Object, required: true },
  fallbackFocusTarget: { type: Function, required: true },
})
defineEmits(['close', 'apply', 'reject'])
</script>
