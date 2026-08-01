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
    :aria-busy="loading"
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
      <p class="mt-1 text-xs text-gray-500">
        Uses the connected media server library as the source of truth.
      </p>
      <p
        v-if="showFreshness"
        class="mt-2 rounded border px-2 py-1 text-xs"
        :class="freshnessClass"
      >
        <span class="font-medium">
          {{ freshness.label }}:
        </span>
        {{ freshness.message }}
      </p>
      <p
        v-if="showFreshness && freshness.updatedAtLabel"
        class="mt-1 text-[11px] text-gray-500"
      >
        {{ freshness.updatedAtLabel }}
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
  freshness: {
    type: Object,
    default: () => ({
      status: 'missing',
      tone: 'warning',
      label: 'No profile yet',
      message: 'Wait for the server-managed profile lifecycle before relying on library-derived intent suggestions.',
      updatedAtLabel: '',
    }),
  },
  loading: {
    type: Boolean,
    default: false,
  },
  showFreshness: {
    type: Boolean,
    default: true,
  },
})

const libraryName = computed(() => props.library?.name || 'Unknown Library')

const freshnessClass = computed(() => {
  return buildToneClass(props.freshness?.tone)
})

function buildToneClass(tone) {
  if (tone === 'success') {
    return 'border-green-800/70 bg-green-950/30 text-green-200'
  }

  if (tone === 'warning') {
    return 'border-amber-700/70 bg-amber-950/30 text-amber-200'
  }

  return 'border-blue-800/70 bg-blue-950/30 text-blue-200'
}
</script>
