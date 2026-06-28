<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    class="flex items-center gap-3 p-3 bg-background-light rounded-lg border border-gray-700"
    aria-label="Policy library context"
  >
    <span
      class="text-2xl"
      aria-hidden="true"
    >
      🔒
    </span>
    <div class="flex-1">
      <div class="text-sm text-gray-400">
        Library
      </div>
      <div class="font-medium">
        {{ libraryName }}
      </div>
      <p class="text-xs text-gray-500 mt-1">
        Uses the connected media server library as the source of truth.
      </p>
      <p
        v-if="genreSummary.length"
        class="text-xs text-gray-400 mt-2"
      >
        Already here:
        <span class="text-gray-300">
          {{ genreSummary.join(', ') }}
        </span>
      </p>
      <p
        v-else-if="profile"
        class="text-xs text-gray-500 mt-2"
      >
        No profile genres are available for this library yet.
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  library: {
    type: Object,
    default: null,
  },
  profile: {
    type: Object,
    default: null,
  },
  genreSummary: {
    type: Array,
    default: () => [],
  },
})

const libraryName = computed(() => props.library?.name || 'Unknown Library')
</script>
