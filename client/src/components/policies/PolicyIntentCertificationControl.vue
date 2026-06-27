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
      :label="controlView.inputLabel"
      :section="section"
    />

    <div class="flex flex-wrap gap-2">
      <PolicyIntentActionButton
        :label="controlView.buttonLabel"
        :readiness="controlReadiness"
        @activate="emitSelectedValue"
      />
      <PolicyIntentSecondaryActionButton
        v-if="controlView.canClear"
        :label="controlView.clearLabel"
        @activate="emit('clear-section', section.key)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import PolicyIntentActionButton from './PolicyIntentActionButton.vue'
import PolicyIntentOptionSelect from './PolicyIntentOptionSelect.vue'
import PolicyIntentSecondaryActionButton from './PolicyIntentSecondaryActionButton.vue'
import { usePolicyIntentOptionAction } from '@/composables/usePolicyIntentOptionAction'
import { buildPolicyIntentControlView } from '@/utils/policyIntentControlView'

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

const controlView = computed(() => buildPolicyIntentControlView(props.section))

const {
  selectedValue,
  controlReadiness,
  submitSelectedValue: emitSelectedValue,
} = usePolicyIntentOptionAction(() => props.section, payload => emit('add-value', payload))

</script>
