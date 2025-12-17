<template>
  <div>
    <h3 class="text-lg font-semibold text-text mb-4">{{ title }}</h3>
    
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      <label
        v-for="label in labels"
        :key="label.value"
        class="flex items-center space-x-2 p-3 bg-background rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
      >
        <input
          type="checkbox"
          :value="label.value"
          :checked="isSelected(label.value)"
          class="w-4 h-4 text-primary bg-card border-gray-600 rounded focus:ring-primary focus:ring-2"
          @change="toggle(label.value)"
        />
        <span class="text-text text-sm">{{ label.label }}</span>
      </label>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  labels: {
    type: Array,
    required: true,
  },
  modelValue: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:modelValue'])

const isSelected = (value) => {
  return props.modelValue.includes(value)
}

const toggle = (value) => {
  const selected = [...props.modelValue]
  const index = selected.indexOf(value)
  
  if (index > -1) {
    selected.splice(index, 1)
  } else {
    selected.push(value)
  }
  
  emit('update:modelValue', selected)
}
</script>
