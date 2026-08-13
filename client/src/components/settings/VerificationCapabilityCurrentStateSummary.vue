<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    class="space-y-4"
    aria-labelledby="verification-capability-summary-heading"
  >
    <div
      class="space-y-2"
      role="status"
      aria-atomic="true"
      :aria-busy="loading"
    >
      <p class="text-xs font-medium uppercase tracking-wide text-blue-200">
        Current saved capability
      </p>
      <h3
        id="verification-capability-summary-heading"
        class="font-medium text-gray-100"
      >
        {{ capability.label }}
      </h3>
      <p class="text-sm text-gray-300">
        {{ capability.message }}
      </p>
      <ul
        v-if="capability.guidance.length > 0"
        class="list-disc space-y-1 pl-5 text-sm text-gray-400"
      >
        <li
          v-for="guidance in capability.guidance"
          :key="guidance"
        >
          {{ guidance }}
        </li>
      </ul>
    </div>

    <p class="text-xs text-gray-500">
      This read-only summary does not test a provider, change settings, or alter classification routing.
    </p>

    <div class="flex flex-wrap gap-3">
      <RouterLink
        :to="{ name: 'Statistics', query: { tab: 'verification' } }"
        class="inline-flex items-center rounded-lg border border-blue-700 px-3 py-2 text-sm font-medium text-blue-200 hover:bg-blue-950/40 focus:outline-none focus:ring-2 focus:ring-primary"
      >
        Review Aggregate Readiness
      </RouterLink>
      <Button
        variant="secondary"
        :disabled="loading"
        @click="emit('refresh')"
      >
        <span v-if="loading">Refreshing...</span>
        <span v-else>Refresh Status</span>
      </Button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import Button from '@/components/common/Button.vue'

const props = defineProps({
  capability: {
    type: Object,
    default: () => null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['refresh'])

const capability = computed(() => ({
  label: typeof props.capability?.label === 'string'
    ? props.capability.label
    : 'Current verification status unavailable',
  message: typeof props.capability?.message === 'string'
    ? props.capability.message
    : 'Classifarr could not read the saved strict-verification capability.',
  guidance: Array.isArray(props.capability?.guidance)
    ? props.capability.guidance.filter((entry) => typeof entry === 'string').slice(0, 3)
    : ['Refresh the status after confirming the saved AI settings.'],
}))
</script>
