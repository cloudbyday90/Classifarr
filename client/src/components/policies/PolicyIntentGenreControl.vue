<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <PolicyIntentOptionActionGroup
    v-model="selectedValue"
    :action-label="controlView.buttonLabel"
    :option-label="controlView.inputLabel"
    :readiness="controlReadiness"
    :section="section"
    @activate="emitSelectedValue"
  />
</template>

<script setup>
import { computed } from 'vue'
import PolicyIntentOptionActionGroup from './PolicyIntentOptionActionGroup.vue'
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
})

const {
  selectedValue,
  controlReadiness,
  submitSelectedValue: emitSelectedValue,
} = usePolicyIntentOptionAction(() => props.section, payload => emit('add-value', payload))

const controlView = computed(() => buildPolicyIntentControlView(props.section))
</script>
