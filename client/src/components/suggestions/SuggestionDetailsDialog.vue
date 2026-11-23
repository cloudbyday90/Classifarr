<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <Modal
    :model-value="true"
    title="Suggestion Details"
    :close-disabled="busy"
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
        <p
          ref="proposalStatus"
          role="status"
          aria-atomic="true"
          tabindex="-1"
          class="text-sm text-gray-300"
        >
          {{ proposalMessage }}
        </p>
        <Button
          v-if="state === 'error' || retrying"
          variant="outline-solid"
          size="sm"
          :aria-disabled="retrying"
          @click="retryProposal"
        >
          Retry proposal
        </Button>
        <dl
          v-if="proposal"
          class="grid gap-3 wrap-anywhere sm:grid-cols-2"
        >
          <div>
            <dt>Policy</dt>
            <dd>{{ proposal.policy_name }}</dd>
          </div>
          <div v-if="proposal.impact_estimate">
            <dt>Expected impact</dt>
            <dd>{{ proposal.impact_estimate }}</dd>
          </div>
          <div
            v-for="[label, value] in fields"
            :key="label"
          >
            <dt>{{ label }}</dt>
            <dd>{{ value ?? 'Unavailable' }}</dd>
          </div>
        </dl>
      </section>
      <SuggestionEvidencePages :suggestion-id="suggestion.id" />
    </div>
    <template
      v-if="canReview && proposal?.status === 'pending'"
      #footer
    >
      <Button
        variant="secondary"
        :aria-disabled="busy"
        @click="review('reject')"
      >
        Reject
      </Button>
      <Button
        v-if="proposal.proposal_status === 'available'"
        variant="success"
        :aria-disabled="busy"
        @click="review('apply')"
      >
        Apply Suggestion
      </Button>
    </template>
  </Modal>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef } from 'vue'
import api from '@/api'
import Button from '@/components/common/Button.vue'
import Modal from '@/components/common/Modal.vue'
import SuggestionEvidencePages from './SuggestionEvidencePages.vue'

const props = defineProps({
  suggestion: { type: Object, required: true },
  canReview: Boolean,
  busy: Boolean,
  fallbackFocusTarget: { type: Function, required: true },
})
const emit = defineEmits(['close', 'apply', 'reject'])

const DISPLAY_FIELDS = {
  adjust_threshold: { threshold_type: 'Threshold', current: 'Current percentage', recommended: 'Recommended percentage' },
  adjust_weight: { signal: 'Signal', current: 'Current weight', recommended: 'Recommended weight' },
  create_pattern: { pattern_type: 'Pattern type', pattern_value: 'Pattern value', confidence: 'Pattern confidence' },
}

const proposal = shallowRef(null)
const state = ref('loading')
const retrying = ref(false)
const proposalStatus = useTemplateRef('proposalStatus')
let active = true

const fields = computed(() => {
  if (proposal.value?.proposal_status !== 'available') return []
  return Object.entries(DISPLAY_FIELDS[proposal.value.suggestion_type])
    .map(([key, label]) => [label, proposal.value.suggestion_config[key]])
})

const proposalMessage = computed(() => {
  if (state.value === 'loading') return 'Loading proposal…'
  if (state.value === 'error') return 'Could not load the proposal. Try again.'
  if (state.value === 'missing') return 'This suggestion is no longer available.'
  if (proposal.value.proposal_status === 'unavailable') return 'This saved proposal cannot be displayed.'
  return 'Saved proposal loaded.'
})

async function loadProposal() {
  state.value = 'loading'
  try {
    const result = await api.getSuggestionProposal(props.suggestion.id)
    if (!active) return
    const available = result?.proposal_status === 'available' && Object.hasOwn(DISPLAY_FIELDS, result.suggestion_type) &&
      result.suggestion_config && typeof result.suggestion_config === 'object' && !Array.isArray(result.suggestion_config)
    const unavailable = result?.proposal_status === 'unavailable' && result.suggestion_config === null
    if (result?.id !== props.suggestion.id || result.policy_id !== props.suggestion.policy_id ||
        result.suggestion_type !== props.suggestion.suggestion_type || (!available && !unavailable)) {
      throw new Error('Invalid suggestion proposal')
    }
    proposal.value = result
    state.value = 'ready'
  } catch (error) {
    if (active) state.value = error?.response?.status === 404 ? 'missing' : 'error'
  }
}

async function retryProposal(event) {
  if (retrying.value) return
  const button = event.currentTarget
  retrying.value = true
  await loadProposal()
  if (state.value !== 'error' && document.activeElement === button) proposalStatus.value?.focus()
  retrying.value = false
}

function review(action) {
  if (!props.canReview || props.busy || proposal.value?.status !== 'pending') return
  if (action === 'apply' && proposal.value.proposal_status !== 'available') return
  emit(action, proposal.value)
}

onMounted(loadProposal)
onBeforeUnmount(() => { active = false })
</script>
