<template>
  <Card class="hover:shadow-xl transition-shadow">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-text-muted text-sm mb-1">{{ title }}</p>
        <p class="text-3xl font-bold text-text">{{ value }}</p>
        <p v-if="subtitle" class="text-text-muted text-sm mt-1">{{ subtitle }}</p>
      </div>
      <div :class="['p-3 rounded-lg', iconBgClass]">
        <component :is="icon" :class="['w-8 h-8', iconColorClass]" />
      </div>
    </div>
  </Card>
</template>

<script setup>
import { computed } from 'vue'
import Card from '@/components/common/Card.vue'

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  value: {
    type: [String, Number],
    required: true,
  },
  subtitle: {
    type: String,
    default: '',
  },
  icon: {
    type: Object,
    required: true,
  },
  variant: {
    type: String,
    default: 'primary',
    validator: (value) => ['primary', 'success', 'warning', 'error'].includes(value),
  },
})

const iconBgClass = computed(() => {
  const classes = {
    primary: 'bg-primary/20',
    success: 'bg-success/20',
    warning: 'bg-warning/20',
    error: 'bg-error/20',
  }
  return classes[props.variant]
})

const iconColorClass = computed(() => {
  const classes = {
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
  }
  return classes[props.variant]
})
</script>
