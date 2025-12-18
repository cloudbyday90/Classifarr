<template>
  <div>
    <div class="border-b border-gray-700">
      <nav class="-mb-px flex space-x-8">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="$emit('update:modelValue', tab.id)"
          :class="[
            'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
            modelValue === tab.id
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-500'
          ]"
        >
          <span v-if="tab.icon" class="mr-2">{{ tab.icon }}</span>
          {{ tab.label }}
          <span v-if="tab.badge" class="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary/20 text-primary">
            {{ tab.badge }}
          </span>
        </button>
      </nav>
    </div>
    <div class="mt-6">
      <slot :name="modelValue" />
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, required: true },
  tabs: { 
    type: Array, 
    required: true 
    // [{ id: 'general', label: 'General', icon: '⚙️', badge: '3' }]
  }
})
defineEmits(['update:modelValue'])
</script>
