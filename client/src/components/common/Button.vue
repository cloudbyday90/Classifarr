<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    :class="buttonClasses"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="inline-block animate-spin mr-2">⚙️</span>
    <slot />
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  type: {
    type: String,
    default: 'button',
  },
  variant: {
    type: String,
    default: 'primary', // primary, secondary, success, warning, error
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['click'])

const buttonClasses = computed(() => {
  const variants = {
    primary: 'bg-primary hover:bg-primary-dark text-white',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
    success: 'bg-success hover:bg-green-600 text-white',
    warning: 'bg-warning hover:bg-yellow-600 text-white',
    error: 'bg-error hover:bg-red-600 text-white',
  }
  return variants[props.variant] || variants.primary
})
</script>
