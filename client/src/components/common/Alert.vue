<template>
  <div
    v-if="show"
    :class="[
      'rounded-lg p-4 flex items-start space-x-3',
      variantClass,
    ]"
  >
    <component :is="icon" class="w-5 h-5 flex-shrink-0 mt-0.5" />
    <div class="flex-1">
      <p v-if="title" class="font-semibold mb-1">{{ title }}</p>
      <p class="text-sm">
        <slot>{{ message }}</slot>
      </p>
    </div>
    <button
      v-if="dismissible"
      @click="show = false"
      class="flex-shrink-0 hover:opacity-75 transition-opacity"
    >
      <XMarkIcon class="w-5 h-5" />
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import {
  InformationCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/vue/24/solid'

const props = defineProps({
  variant: {
    type: String,
    default: 'info',
    validator: (value) => ['info', 'success', 'warning', 'error'].includes(value),
  },
  title: {
    type: String,
    default: '',
  },
  message: {
    type: String,
    default: '',
  },
  dismissible: {
    type: Boolean,
    default: false,
  },
})

const show = ref(true)

const icon = computed(() => {
  const icons = {
    info: InformationCircleIcon,
    success: CheckCircleIcon,
    warning: ExclamationTriangleIcon,
    error: XCircleIcon,
  }
  return icons[props.variant]
})

const variantClass = computed(() => {
  const variants = {
    info: 'bg-primary/20 text-primary',
    success: 'bg-success/20 text-success',
    warning: 'bg-warning/20 text-warning',
    error: 'bg-error/20 text-error',
  }
  return variants[props.variant]
})
</script>
