<template>
  <span
    class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
    :class="badgeClasses"
  >
    <slot />
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'default', // default, success, warning, error, info
  },
})

const badgeClasses = computed(() => {
  const variants = {
    default: 'bg-gray-700 text-gray-200',
    success: 'bg-success bg-opacity-20 text-success',
    warning: 'bg-warning bg-opacity-20 text-warning',
    error: 'bg-error bg-opacity-20 text-error',
    info: 'bg-primary bg-opacity-20 text-primary',
  }
  return variants[props.variant] || variants.default
})
</script>
