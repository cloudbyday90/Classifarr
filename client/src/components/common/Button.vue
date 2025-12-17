<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="[
      'btn',
      variantClass,
      sizeClass,
      disabled || loading ? 'opacity-50 cursor-not-allowed' : '',
      fullWidth ? 'w-full' : '',
    ]"
  >
    <component v-if="loading" :is="LoadingIcon" class="animate-spin -ml-1 mr-2 h-4 w-4" />
    <component v-else-if="icon" :is="icon" :class="iconSizeClass" />
    <span v-if="$slots.default">
      <slot />
    </span>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { ArrowPathIcon } from '@heroicons/vue/24/outline'

const LoadingIcon = ArrowPathIcon

const props = defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (value) => ['primary', 'secondary', 'success', 'danger'].includes(value),
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg'].includes(value),
  },
  type: {
    type: String,
    default: 'button',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  fullWidth: {
    type: Boolean,
    default: false,
  },
  icon: {
    type: Object,
    default: null,
  },
})

const variantClass = computed(() => {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    success: 'btn-success',
    danger: 'btn-danger',
  }
  return variants[props.variant]
})

const sizeClass = computed(() => {
  const sizes = {
    sm: 'text-sm px-3 py-1.5',
    md: 'text-base px-4 py-2',
    lg: 'text-lg px-6 py-3',
  }
  return sizes[props.size]
})

const iconSizeClass = computed(() => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }
  return sizes[props.size]
})
</script>
