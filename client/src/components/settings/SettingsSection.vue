<template>
  <div class="mb-8">
    <h2 class="text-2xl font-bold text-text mb-2">{{ title }}</h2>
    <p v-if="description" class="text-text-muted">{{ description }}</p>
    <div class="mt-6">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
})
</script>
