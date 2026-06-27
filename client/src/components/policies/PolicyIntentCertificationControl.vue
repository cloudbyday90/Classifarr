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
import { computed } from 'vue'
import PolicyIntentActionButton from './PolicyIntentActionButton.vue'
import PolicyIntentOptionSelect from './PolicyIntentOptionSelect.vue'
import { usePolicyIntentOptionAction } from '@/composables/usePolicyIntentOptionAction'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'

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

const isHardLimit = computed(() => props.section.key === POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS)

const {
  selectedValue,
  controlReadiness,
  submitSelectedValue: emitSelectedValue,
} = usePolicyIntentOptionAction(() => props.section, payload => emit('add-value', payload))

const inputLabel = computed(() => isHardLimit.value
  ? 'Maximum allowed rating'
  : 'Rating to avoid')

const buttonLabel = computed(() => isHardLimit.value
  ? 'Set max rating'
  : 'Add avoid rating')
</script>
