<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section class="border border-gray-700 rounded-lg bg-background-light/40">
    <button
      type="button"
      class="w-full flex flex-col gap-2 p-4 text-left sm:flex-row sm:items-start sm:justify-between"
      :aria-expanded="String(isOpen)"
      aria-controls="policy-builder-starter-template-accelerator"
      @click="toggleOpen"
    >
      <div>
        <h3
          id="policy-builder-starter-template-accelerator-title"
          class="text-sm font-semibold text-white flex items-center gap-2"
        >
          <span aria-hidden="true">{{ isOpen ? '▼' : '▶' }}</span>
          Starter Template Accelerator
        </h3>
        <p class="text-xs text-gray-400 mt-1 max-w-2xl">
          Optional shortcut. Use templates only when they help seed draft
          values; destination context and declared intent remain the product
          model.
        </p>
      </div>
      <span class="text-xs px-2 py-1 rounded-full border border-gray-600 text-gray-300 bg-background">
        Optional · {{ selectedPresets.length }} selected
      </span>
    </button>

    <div
      v-if="isOpen"
      id="policy-builder-starter-template-accelerator"
      role="region"
      aria-labelledby="policy-builder-starter-template-accelerator-title"
      class="p-4 pt-0 space-y-4"
    >
      <p class="rounded-md border border-gray-700 bg-background px-3 py-2 text-xs text-gray-400">
        Saving without a starter template is allowed. Templates are compatibility
        accelerators for seeding draft values, not required policy authority.
      </p>

      <PolicyStarterTemplateBrowser
        :search-query="searchQuery"
        :selected-category="selectedCategory"
        :suggested-presets="suggestedPresets"
        :available-presets="availablePresets"
        :selected-presets="selectedPresets"
        :all-presets="allPresets"
        :category-tabs="categoryTabs"
        :get-preset-usage-count="getPresetUsageCount"
        :format-usage-label="formatUsageLabel"
        @add-all-suggested="emit('add-all-suggested')"
        @toggle-preset="preset => emit('toggle-preset', preset)"
        @update:search-query="query => emit('update:searchQuery', query)"
        @update:selected-category="category => emit('update:selectedCategory', category)"
      />

      <div class="border-t border-gray-700" />

      <PolicySelectedStarterTemplates
        :selected-presets="selectedPresets"
        :expanded-preset-ids="expandedPresetIds"
        :all-presets="allPresets"
        :available-ratings="availableRatings"
        :available-genres="availableGenres"
        @toggle-preset-customize="presetId => emit('toggle-preset-customize', presetId)"
        @remove-preset="presetId => emit('remove-preset', presetId)"
        @update-preset-weight="payload => emit('update-preset-weight', payload)"
        @add-custom-signal="payload => emit('add-custom-signal', payload)"
        @remove-custom-signal="payload => emit('remove-custom-signal', payload)"
        @set-signal-removal="payload => emit('set-signal-removal', payload)"
        @set-signal-strict="payload => emit('set-signal-strict', payload)"
      />

      <PolicyCombinedSignalsSummary
        :preset-count="selectedPresets.length"
        :combined-signals="combinedSignals"
      />
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import PolicyCombinedSignalsSummary from '@/components/policies/PolicyCombinedSignalsSummary.vue'
import PolicySelectedStarterTemplates from '@/components/policies/PolicySelectedStarterTemplates.vue'
import PolicyStarterTemplateBrowser from '@/components/policies/PolicyStarterTemplateBrowser.vue'

defineProps({
  searchQuery: {
    type: String,
    default: '',
  },
  selectedCategory: {
    type: String,
    default: 'all',
  },
  suggestedPresets: {
    type: Array,
    default: () => [],
  },
  availablePresets: {
    type: Array,
    default: () => [],
  },
  selectedPresets: {
    type: Array,
    default: () => [],
  },
  allPresets: {
    type: Array,
    default: () => [],
  },
  categoryTabs: {
    type: Array,
    default: () => [],
  },
  expandedPresetIds: {
    type: [Object, Array],
    default: () => new Set(),
  },
  availableRatings: {
    type: Array,
    default: () => [],
  },
  availableGenres: {
    type: Array,
    default: () => [],
  },
  combinedSignals: {
    type: Object,
    default: () => ({}),
  },
  getPresetUsageCount: {
    type: Function,
    default: () => 0,
  },
  formatUsageLabel: {
    type: Function,
    default: count => `Used in ${count} policies`,
  },
})

const emit = defineEmits({
  'update:searchQuery': query => typeof query === 'string',
  'update:selectedCategory': category => typeof category === 'string',
  'add-all-suggested': null,
  'toggle-preset': preset => Boolean(preset),
  'toggle-preset-customize': presetId => presetId !== null && presetId !== undefined,
  'remove-preset': presetId => presetId !== null && presetId !== undefined,
  'update-preset-weight': payload => Boolean(payload),
  'add-custom-signal': payload => Boolean(payload),
  'remove-custom-signal': payload => Boolean(payload),
  'set-signal-removal': payload => Boolean(payload),
  'set-signal-strict': payload => Boolean(payload),
})

const showMechanics = ref(false)
const isOpen = computed(() => showMechanics.value)

const toggleOpen = () => {
  showMechanics.value = !showMechanics.value
}
</script>
