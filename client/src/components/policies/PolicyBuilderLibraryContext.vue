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
    :aria-busy="loading || refreshing"
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
      <div class="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-xs text-gray-500">
          Uses the connected media server library as the source of truth.
        </p>
        <button
          v-if="showRefreshAction"
          type="button"
          class="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!canRefresh || loading || refreshing"
          @click="emit('refresh-profile')"
        >
          {{ refreshing ? 'Refreshing...' : 'Refresh profile' }}
        </button>
      </div>
      <p
        class="mt-2 rounded border px-2 py-1 text-xs"
        :class="freshnessClass"
        role="status"
      >
        <span class="font-medium">
          {{ freshness.label }}:
        </span>
        {{ freshness.message }}
      </p>
      <p
        v-if="freshness.updatedAtLabel"
        class="mt-1 text-[11px] text-gray-500"
      >
        {{ freshness.updatedAtLabel }}
      </p>
      <p
        v-if="refreshResult"
        class="mt-2 rounded border px-2 py-1 text-xs"
        :class="refreshResultClass"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span class="font-medium">
          {{ refreshResult.label }}:
        </span>
        {{ refreshResult.message }}
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
      message: 'Generate a profile after library sync and enrichment before relying on library-derived intent suggestions.',
      canRefresh: true,
      updatedAtLabel: '',
    }),
  },
  loading: {
    type: Boolean,
    default: false,
  },
  refreshing: {
    type: Boolean,
    default: false,
  },
  canRefresh: {
    type: Boolean,
    default: false,
  },
  showRefreshAction: {
    type: Boolean,
    default: true,
  },
  refreshResult: {
    type: Object,
    default: null,
  },
})

const libraryName = computed(() => props.library?.name || 'Unknown Library')
const emit = defineEmits({
  'refresh-profile': () => true,
})

const freshnessClass = computed(() => {
  return buildToneClass(props.freshness?.tone)
})

const refreshResultClass = computed(() => buildToneClass(props.refreshResult?.tone))

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
