<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <article
    :id="`policy-authoring-lifecycle-${entry.library.id}`"
    class="rounded-lg border border-gray-700 bg-gray-900/40 p-5"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="text-lg font-semibold text-white">
          {{ entry.library.name }}
        </h3>
        <p
          v-if="entry.library.mediaType"
          class="mt-1 text-sm text-gray-400"
        >
          {{ entry.library.mediaType }} library
        </p>
      </div>
      <span
        :class="badgeClass"
        class="rounded-full border px-3 py-1 text-xs font-semibold"
      >
        {{ entry.label }}
      </span>
    </div>

    <p class="mt-4 text-sm leading-6 text-gray-300">
      {{ entry.message }}
    </p>

    <p
      v-if="entry.policy?.name"
      class="mt-3 text-sm text-gray-400"
    >
      Existing policy: <span class="font-medium text-gray-200">{{ entry.policy.name }}</span>
    </p>

    <div
      v-if="entry.canSelect"
      class="mt-5"
    >
      <button
        :id="`policy-authoring-lifecycle-action-${entry.library.id}`"
        type="button"
        class="rounded border border-primary bg-primary/10 px-4 py-2 text-sm font-medium text-white hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-950"
        @click="$emit('select', entry.library.id)"
      >
        Review destination proposal
      </button>
    </div>

    <div
      v-else-if="entry.canReviewMaintenance"
      class="mt-5"
    >
      <button
        :id="`policy-authoring-lifecycle-maintenance-action-${entry.library.id}`"
        type="button"
        class="rounded border border-amber-500/70 bg-amber-950/20 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-950/40 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-gray-950"
        @click="$emit('review-maintenance', entry)"
      >
        Review policy maintenance
      </button>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  entry: {
    type: Object,
    required: true,
  },
})

defineEmits({
  select: libraryId => Number.isInteger(Number(libraryId)) && Number(libraryId) > 0,
  'review-maintenance': entry => Number.isInteger(Number(entry?.policy?.id)) && Number(entry.policy.id) > 0,
})

const badgeClass = computed(() => {
  switch (props.entry.tone) {
    case 'success':
      return 'border-green-700/80 bg-green-950/50 text-green-200'
    case 'warning':
      return 'border-amber-700/80 bg-amber-950/50 text-amber-100'
    case 'danger':
      return 'border-red-700/80 bg-red-950/50 text-red-100'
    default:
      return 'border-gray-600 bg-gray-800 text-gray-200'
  }
})
</script>
