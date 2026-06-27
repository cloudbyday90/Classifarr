<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-2">
    <PolicyIntentOptionSelect
      v-model="selectedValue"
      :label="inputLabel"
      :section="section"
    />

    <div class="flex flex-wrap gap-2">
      <PolicyIntentActionButton
        :label="buttonLabel"
        :readiness="controlReadiness"
        @activate="emitSelectedValue"
      />
      <button
        v-if="section.hasClearAction"
        type="button"
        class="px-2 py-1 border border-gray-600 rounded-sm text-xs text-gray-300 hover:bg-gray-700"
        @click="emit('clear-section', section.key)"
      >
        Clear max rating
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import PolicyIntentActionButton from './PolicyIntentActionButton.vue'
import PolicyIntentOptionSelect from './PolicyIntentOptionSelect.vue'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'
import {
  buildPolicyIntentControlReadiness,
  resolvePolicyIntentOptionStates,
} from '@/utils/policyIntentSectionProjection'

const props = defineProps({
  section: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits({
  'add-value': payload => Boolean(payload?.sectionKey && payload?.value),
  'clear-section': sectionKey => typeof sectionKey === 'string' && sectionKey.length > 0,
})

const selectedValue = ref('')

const isHardLimit = computed(() => props.section.key === POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS)

const optionStates = computed(() => resolvePolicyIntentOptionStates(props.section))

const controlReadiness = computed(() => {
  return buildPolicyIntentControlReadiness(props.section.key, {
    selectedValue: selectedValue.value,
    optionStates: optionStates.value,
    optionDiagnostics: props.section.optionDiagnostics,
  })
})

const inputLabel = computed(() => isHardLimit.value
  ? 'Maximum allowed rating'
  : 'Rating to avoid')

const buttonLabel = computed(() => isHardLimit.value
  ? 'Set max rating'
  : 'Add avoid rating')

const emitSelectedValue = () => {
  if (!controlReadiness.value.canSubmit) return

  emit('add-value', {
    sectionKey: props.section.key,
    value: selectedValue.value,
  })
  selectedValue.value = ''
}
</script>
