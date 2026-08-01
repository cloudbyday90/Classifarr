<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    class="rounded-lg border border-gray-700 bg-background-light p-3"
    aria-labelledby="policy-builder-observed-profile-title"
  >
    <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h5
          id="policy-builder-observed-profile-title"
          class="text-sm font-semibold text-white"
        >
          What Classifarr sees in {{ displayLibraryName }}
        </h5>
        <p class="mt-1 text-xs text-gray-400">
          Current library observations make the next choices easier. They are suggestions, not policy rules, until you explicitly accept them.
        </p>
      </div>
      <span
        class="w-fit rounded-full border px-2 py-1 text-xs font-medium"
        :class="profileClass"
      >
        {{ profileLabel }}
      </span>
    </div>

    <p
      v-if="!observedProfile.available"
      class="mt-3 text-sm text-gray-300"
    >
      A current library profile is not available yet.
    </p>
    <p
      v-else-if="suggestions.length === 0"
      class="mt-3 text-sm text-gray-300"
    >
      {{ selectionEnabled
        ? 'Classifarr has not found reusable library observations yet.'
        : 'Classifarr has not found reusable library observations yet. You can still describe the destination below.' }}
    </p>
    <p
      v-if="automaticGuidance"
      class="mt-3 rounded border border-blue-800/70 bg-blue-950/30 px-3 py-2 text-xs text-blue-100"
      role="status"
      aria-live="polite"
    >
      {{ automaticGuidance.message }}
    </p>
    <ul
      v-else-if="!selectionEnabled"
      class="mt-3 flex flex-wrap gap-2"
      aria-label="Observed library suggestions"
    >
      <li
        v-for="suggestion in suggestions"
        :key="suggestion.key"
        class="rounded border border-gray-700 bg-background px-2 py-1 text-xs text-gray-200"
      >
        <span class="font-medium">{{ suggestion.label }}</span>
        <span
          v-if="suggestion.count !== null"
          class="ml-1 text-gray-400"
        >
          {{ suggestion.count }} currently here
        </span>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  libraryName: {
    type: String,
    default: '',
  },
  observedProfile: {
    type: Object,
    default: () => ({}),
  },
  suggestions: {
    type: Array,
    default: () => [],
  },
  selectionEnabled: {
    type: Boolean,
    default: false,
  },
  automaticGuidance: {
    type: Object,
    default: null,
  },
})

const displayLibraryName = computed(() => props.libraryName || 'this library')

const profileLabel = computed(() => {
  if (!props.observedProfile.available) return 'Profile unavailable'
  if (!props.observedProfile.current) return 'Profile needs refresh'

  const count = Number(props.observedProfile.suggestionCount) || 0
  return `${count} observed ${count === 1 ? 'signal' : 'signals'}`
})

const profileClass = computed(() => {
  if (!props.observedProfile.available || !props.observedProfile.current) {
    return 'border-amber-700/70 bg-amber-950/30 text-amber-200'
  }

  return 'border-green-800/70 bg-green-950/30 text-green-200'
})
</script>
