<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div
    v-if="presetCount > 1"
    class="border border-primary/30 rounded-lg p-4 bg-primary/5"
  >
    <h4 class="font-semibold mb-3 flex items-center gap-2">
      <span class="text-primary">🔗</span>
      Combined Signals ({{ presetCount }} presets)
    </h4>
    <div class="space-y-3 text-sm">
      <div
        v-for="section in visibleSections"
        :key="section.key"
      >
        <label class="font-medium text-gray-300 block mb-1">{{ section.label }}</label>
        <div class="flex flex-wrap gap-1">
          <span
            v-for="item in section.items"
            :key="section.key + '-' + item.value"
            class="px-2 py-0.5 rounded-sm text-xs"
            :class="section.className"
            :title="'From: ' + item.sources.join(', ')"
          >
            {{ formatSignalValue(section, item.value) }}
            <span class="text-gray-500">({{ item.sources.length }})</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  presetCount: {
    type: Number,
    default: 0,
  },
  combinedSignals: {
    type: Object,
    required: true,
  },
})

const getItems = (signalType, key) => {
  const values = props.combinedSignals?.[signalType]?.[key]
  return Array.isArray(values) ? values : []
}

const sections = computed(() => [
  {
    key: 'certifications-include',
    label: 'Content Ratings (included):',
    items: getItems('certifications', 'include'),
    className: 'bg-green-900/30 text-green-400',
  },
  {
    key: 'genres-prefer',
    label: 'Preferred Genres:',
    items: getItems('genres', 'prefer'),
    className: 'bg-blue-900/30 text-blue-400',
  },
  {
    key: 'genres-exclude',
    label: 'Excluded Genres:',
    items: getItems('genres', 'exclude'),
    prefix: '✕',
    className: 'bg-red-900/30 text-red-400',
  },
  {
    key: 'keywords-prefer',
    label: 'Preferred Keywords:',
    items: getItems('keywords', 'prefer'),
    className: 'bg-blue-900/30 text-blue-400',
  },
  {
    key: 'keywords-exclude',
    label: 'Excluded Keywords:',
    items: getItems('keywords', 'exclude'),
    prefix: '✕',
    className: 'bg-red-900/30 text-red-400',
  },
  {
    key: 'keywords-require-any',
    label: 'Required Keywords (any match):',
    items: getItems('keywords', 'require_any'),
    className: 'bg-green-900/30 text-green-400',
  },
])

const visibleSections = computed(() => sections.value.filter(section => section.items.length > 0))

const formatSignalValue = (section, value) => {
  return section.prefix ? `${section.prefix} ${value}` : value
}
</script>
