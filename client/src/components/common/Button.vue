<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="inline-flex items-center justify-center font-medium transition-all rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
    :class="[buttonClasses, sizeClasses]"
    @click="$emit('click', $event)"
  >
    <Spinner v-if="loading" :size="size === 'sm' ? 'sm' : 'md'" color="white" class="mr-2" />
    <span v-if="icon && !loading" class="mr-2">{{ icon }}</span>
    <slot />
  </button>
</template>

<script setup>
import { computed } from 'vue'
import Spinner from './Spinner.vue'

const props = defineProps({
  type: { type: String, default: 'button' },
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'md' }, // sm, md, lg
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  icon: { type: String, default: '' }
})

defineEmits(['click'])

const buttonClasses = computed(() => ({
  'primary': 'bg-primary hover:bg-primary-dark text-white',
  'secondary': 'bg-gray-600 hover:bg-gray-700 text-white',
  'success': 'bg-success hover:bg-green-600 text-white',
  'warning': 'bg-warning hover:bg-yellow-600 text-white',
  'error': 'bg-error hover:bg-red-600 text-white',
  'ghost': 'bg-transparent hover:bg-gray-800 text-gray-300',
  'outline': 'bg-transparent border border-gray-600 hover:border-gray-500 text-gray-300'
}[props.variant]))

const sizeClasses = computed(() => ({
  'sm': 'px-3 py-1.5 text-sm',
  'md': 'px-4 py-2 text-sm',
  'lg': 'px-6 py-3 text-base'
}[props.size]))
</script>
