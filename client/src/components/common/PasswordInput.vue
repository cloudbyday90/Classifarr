<template>
  <div class="flex flex-col gap-2">
    <label v-if="label" class="text-sm font-medium">{{ label }}</label>
    <div class="relative">
      <input
        :type="visible ? 'text' : 'password'"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :autocomplete="autocomplete"
        class="w-full px-4 py-2 pr-12 bg-background border border-gray-700 rounded-lg focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
        @input="$emit('update:modelValue', $event.target.value)"
      />
      <button
        type="button"
        @click="visible = !visible"
        class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 focus:outline-none"
        :disabled="disabled"
      >
        <span v-if="visible">🙈</span>
        <span v-else>👁️</span>
      </button>
    </div>
    <span v-if="error" class="text-sm text-error">{{ error }}</span>
    <span v-if="hint" class="text-xs text-gray-500">{{ hint }}</span>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  error: { type: String, default: '' },
  hint: { type: String, default: '' },
  autocomplete: { type: String, default: 'current-password' }
})
defineEmits(['update:modelValue'])

const visible = ref(false)
</script>
