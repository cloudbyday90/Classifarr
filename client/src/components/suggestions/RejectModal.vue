<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <Modal
    :model-value="true"
    title="Reject Suggestion"
    :close-disabled="busy"
    :fallback-focus-target="fallbackFocusTarget"
    @update:model-value="$emit('cancel')"
  >
    <form
      :id="formId"
      class="space-y-3"
      @submit.prevent="submit"
    >
      <p class="capitalize wrap-anywhere">
        {{ suggestion.suggestion_type.replaceAll('_', ' ') }} · {{ suggestion.policy_name }}
      </p>
      <label :for="reasonId">Reason for rejection (optional)</label>
      <textarea
        :id="reasonId"
        v-model="reason"
        class="w-full rounded border border-gray-600 bg-background px-3 py-2"
        rows="3"
      />
    </form>

    <template #footer>
      <Button
        variant="secondary"
        :aria-disabled="busy"
        @click="cancel"
      >
        Cancel
      </Button>
      <Button
        type="submit"
        variant="error"
        :form="formId"
        :aria-disabled="busy"
      >
        Reject Suggestion
      </Button>
    </template>
  </Modal>
</template>

<script setup>
import { ref, useId } from 'vue'
import Button from '@/components/common/Button.vue'
import Modal from '@/components/common/Modal.vue'

const props = defineProps({
  suggestion: { type: Object, required: true },
  busy: Boolean,
  fallbackFocusTarget: { type: Function, required: true },
})
const emit = defineEmits(['confirm', 'cancel'])

const reason = ref('')
const formId = `reject-suggestion-${useId()}`
const reasonId = `${formId}-reason`

function submit() {
  if (!props.busy) emit('confirm', reason.value || 'No reason provided')
}

function cancel() {
  if (!props.busy) emit('cancel')
}
</script>
