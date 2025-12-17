<template>
  <div class="mb-4">
    <label v-if="label" :for="id" class="block text-sm font-medium text-text mb-2">
      {{ label }}
      <span v-if="required" class="text-error">*</span>
    </label>
    <slot />
    <p v-if="help" class="text-text-muted text-sm mt-1">{{ help }}</p>
    <p v-if="error" class="text-error text-sm mt-1">{{ error }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: {
    type: String,
    default: '',
  },
  help: {
    type: String,
    default: '',
  },
  error: {
    type: String,
    default: '',
  },
  required: {
    type: Boolean,
    default: false,
  },
})

const id = computed(() => {
  return 'field-' + Math.random().toString(36).substr(2, 9)
})
</script>
