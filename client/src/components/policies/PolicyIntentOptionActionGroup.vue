<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-2">
    <PolicyIntentOptionSelect
      :model-value="modelValue"
      :label="optionLabel"
      :multiple="multiple"
      :section="section"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <div class="flex flex-wrap gap-2">
      <PolicyIntentActionButton
        :label="actionLabel"
        :readiness="readiness"
        @activate="emit('activate')"
      />
      <slot name="secondary-actions" />
    </div>
  </div>
</template>

<script setup>
import PolicyIntentActionButton from './PolicyIntentActionButton.vue'
import PolicyIntentOptionSelect from './PolicyIntentOptionSelect.vue'

defineProps({
  actionLabel: {
    type: String,
    required: true,
  },
  modelValue: {
    type: [String, Array],
    default: '',
  },
  multiple: {
    type: Boolean,
    default: false,
  },
  optionLabel: {
    type: String,
    required: true,
  },
  readiness: {
    type: Object,
    required: true,
  },
  section: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits({
  activate: () => true,
  'update:modelValue': value => typeof value === 'string' || Array.isArray(value),
})
</script>
