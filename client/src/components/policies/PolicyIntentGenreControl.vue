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

    <PolicyIntentActionButton
      :label="controlView.buttonLabel"
      :readiness="controlReadiness"
      @activate="emitSelectedValue"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import PolicyIntentActionButton from './PolicyIntentActionButton.vue'
import PolicyIntentOptionSelect from './PolicyIntentOptionSelect.vue'
import { usePolicyIntentOptionAction } from '@/composables/usePolicyIntentOptionAction'
import { buildPolicyIntentGenreControlView } from '@/utils/policyIntentGenreControl'

const props = defineProps({
  section: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits({
  'add-value': payload => Boolean(payload?.sectionKey && payload?.value),
})

const {
  selectedValue,
  controlReadiness,
  submitSelectedValue: emitSelectedValue,
} = usePolicyIntentOptionAction(() => props.section, payload => emit('add-value', payload))

const controlView = computed(() => buildPolicyIntentGenreControlView(props.section))
</script>
