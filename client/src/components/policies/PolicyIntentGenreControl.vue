<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-2">
    <label class="block">
      <span class="text-[11px] font-medium text-gray-400">
        {{ inputLabel }}
      </span>
      <select
        v-model="selectedValue"
        class="mt-1 w-full px-2 py-1 bg-background border border-gray-700 rounded-sm text-xs"
      >
        <option value="">
          {{ section.addLabel }}
        </option>
        <option
          v-for="option in section.options"
          :key="section.key + '-' + option"
          :value="option"
        >
          {{ option }}
        </option>
      </select>
    </label>

    <button
      type="button"
      class="px-2 py-1 border border-primary/60 rounded-sm text-xs text-primary hover:bg-primary/10 disabled:opacity-50 disabled:hover:bg-transparent"
      :disabled="!selectedValue"
      @click="emitSelectedValue"
    >
      {{ buttonLabel }}
    </button>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
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

const selectedValue = ref('')

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

const emitSelectedValue = () => {
  if (!selectedValue.value) return

  emit('add-value', {
    sectionKey: props.section.key,
    value: selectedValue.value,
  })
  selectedValue.value = ''
}
</script>
