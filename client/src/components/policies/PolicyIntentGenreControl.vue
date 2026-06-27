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

    <PolicyIntentActionButton
      :label="buttonLabel"
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
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'

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

const inputLabel = computed(() => {
  if (props.section.key === POLICY_INTENT_BUCKETS.IDENTITY) return 'Genre that defines this library'
  if (props.section.key === POLICY_INTENT_BUCKETS.COMPATIBILITY) return 'Genre that can support a match'
  if (props.section.key === POLICY_INTENT_BUCKETS.BOOSTERS) return 'Genre that boosts confidence'
  return 'Genre signal'
})

const buttonLabel = computed(() => {
  if (props.section.key === POLICY_INTENT_BUCKETS.IDENTITY) return 'Add belongs-here genre'
  if (props.section.key === POLICY_INTENT_BUCKETS.COMPATIBILITY) return 'Add helpful genre'
  if (props.section.key === POLICY_INTENT_BUCKETS.BOOSTERS) return 'Add confidence boost'
  return 'Add genre'
})
</script>
