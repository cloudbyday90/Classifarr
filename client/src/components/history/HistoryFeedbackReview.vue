<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section>
    <button
      type="button"
      class="feedback-button"
      @click="openReview"
    >
      Review library feedback
    </button>
    <Modal
      v-model="visible"
      title="Review library feedback"
      :fallback-focus-target="fallbackFocus"
    >
      <p>Record an assessment of the original automated destination. This records feedback and existing feedback statistics; it does not move media, reclassify the item or create policy rules.</p>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {{ review.message.value }}
      </p>
      <p
        v-if="review.warning.value"
        role="alert"
      >
        {{ review.warning.value }}
      </p>
      <template v-if="review.preview.value">
        <h4>{{ review.preview.value.item.title }}</h4>
        <p>Original automated destination: <strong>{{ review.preview.value.reference.libraryName }}</strong></p>
        <p>Current recorded outcome: {{ review.preview.value.item.currentOutcome || 'Unavailable' }}. These are different references.</p>
        <p>Review expires at <time :datetime="review.preview.value.expiresAt">{{ new Date(review.preview.value.expiresAt).toLocaleString() }}</time>.</p>
        <p
          v-if="review.expired.value"
          role="alert"
        >
          This reference expired. Prepare a new review before submitting.
        </p>
        <label :for="confirmId">Policy for feedback confirming the original destination</label>
        <select
          :id="confirmId"
          v-model="confirmPolicy"
          :disabled="!review.canSubmit.value"
        >
          <option value="">
            Choose a policy…
          </option>
          <option
            v-for="choice in confirmChoices"
            :key="choice.policyId"
            :value="choice.policyId"
          >
            {{ choice.policyName }}
          </option>
        </select>
        <button
          type="button"
          class="feedback-button"
          :disabled="!confirmPolicy || !review.canSubmit.value"
          @click="review.submit('confirmation', confirmPolicy)"
        >
          Confirm original destination as feedback
        </button>
        <label :for="changeId">Different destination and policy for this feedback assessment</label>
        <select
          :id="changeId"
          v-model="changePolicy"
          :disabled="!review.canSubmit.value"
        >
          <option value="">
            Choose a different destination…
          </option>
          <option
            v-for="choice in changeChoices"
            :key="choice.policyId"
            :value="choice.policyId"
          >
            {{ choice.libraryName }} — {{ choice.policyName }}
          </option>
        </select>
        <button
          type="button"
          class="feedback-button"
          :disabled="!changePolicy || !review.canSubmit.value"
          @click="review.submit('correction', changePolicy)"
        >
          Record different destination as feedback
        </button>
      </template>
      <div v-if="review.pending.value">
        <p>The stored submission can only be checked or repeated exactly. Receipt recovery requires the same active administrator account.</p>
        <button
          type="button"
          class="feedback-button"
          :disabled="review.busy.value"
          @click="review.check"
        >
          Check feedback receipt
        </button>
        <button
          type="button"
          class="feedback-button"
          :disabled="review.busy.value"
          @click="review.retry"
        >
          Retry the same feedback submission
        </button>
      </div>
      <button
        v-if="!review.pending.value && review.phase.value !== 'recorded'"
        type="button"
        class="feedback-button"
        :disabled="review.busy.value"
        @click="review.prepare"
      >
        Prepare a new review
      </button>
    </Modal>
  </section>
</template>
<script setup>
import { computed, ref, toRef, useId, watch } from 'vue'
import Modal from '@/components/common/Modal.vue'
import { useFeedbackReview } from '@/composables/useFeedbackReview'
const props = defineProps({ classificationId: { type: [String, Number], required: true } })
const visible = ref(false), confirmPolicy = ref(''), changePolicy = ref('')
const review = useFeedbackReview(toRef(props, 'classificationId'))
const confirmId = `feedback-confirm-${useId()}`, changeId = `feedback-change-${useId()}`
const confirmChoices = computed(() => review.preview.value?.choices.filter(choice => choice.libraryId === review.preview.value.reference.libraryId) ?? [])
const changeChoices = computed(() => review.preview.value?.choices.filter(choice => choice.libraryId !== review.preview.value.reference.libraryId) ?? [])
const fallbackFocus = () => { const element = document.querySelector('main button'); return element instanceof HTMLElement ? element : null }
function openReview() { visible.value = true; void review.open() }
watch(visible, value => { if (!value) review.close() })
watch(review.preview, () => { confirmPolicy.value = ''; changePolicy.value = '' })
</script>
<style scoped>
p, h4, label, select, button { margin-top: .75rem; }
h4 { font-weight: 600; }
label { display: block; }
select { display: block; width: 100%; border: 1px solid #64748b; border-radius: .375rem; padding: .5rem; background: #111827; color: #f3f4f6; }
.feedback-button { border: 1px solid #64748b; border-radius: .375rem; padding: .5rem .75rem; color: #bfdbfe; }
.feedback-button:disabled { opacity: .5; cursor: not-allowed; }
button:focus-visible, select:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
</style>
