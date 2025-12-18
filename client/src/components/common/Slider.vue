<template>
  <div class="flex flex-col gap-2">
    <div class="flex justify-between items-center">
      <label v-if="label" class="text-sm font-medium">{{ label }}</label>
      <span class="text-sm text-primary font-medium">{{ displayValue }}</span>
    </div>
    <input
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      :disabled="disabled"
      class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider disabled:opacity-50 disabled:cursor-not-allowed"
      @input="$emit('update:modelValue', parseFloat($event.target.value))"
    />
    <div class="flex justify-between text-xs text-gray-500">
      <span>{{ min }}{{ unit }}</span>
      <span>{{ max }}{{ unit }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Number, default: 0 },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  step: { type: Number, default: 1 },
  label: { type: String, default: '' },
  unit: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
})

defineEmits(['update:modelValue'])

const displayValue = computed(() => `${props.modelValue}${props.unit}`)
</script>

<style scoped>
.slider::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgb(59, 130, 246); /* primary color */
  cursor: pointer;
  border: 2px solid rgb(26, 29, 36); /* background color */
}
.slider::-webkit-slider-thumb:hover {
  background: rgb(37, 99, 235); /* primary-dark color */
}
.slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgb(59, 130, 246); /* primary color */
  cursor: pointer;
  border: 2px solid rgb(26, 29, 36); /* background color */
}
.slider::-moz-range-thumb:hover {
  background: rgb(37, 99, 235); /* primary-dark color */
}
</style>
