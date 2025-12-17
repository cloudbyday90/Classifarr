<template>
  <div :class="['card', padding ? `p-${padding}` : 'p-6', className]">
    <div v-if="title || $slots.header" class="mb-4">
      <slot name="header">
        <h3 class="text-lg font-semibold text-text">{{ title }}</h3>
      </slot>
    </div>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: '',
  },
  padding: {
    type: [String, Number],
    default: null,
  },
  className: {
    type: String,
    default: '',
  },
})
</script>
