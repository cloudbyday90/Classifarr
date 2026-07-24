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
        Saving without a starter template is allowed. A selected template seeds
        the declared intent shown above; adjust the resulting intent there.
      </p>

      <PolicyStarterTemplateBrowser
        :search-query="searchQuery"
        :selected-category="selectedCategory"
        :suggested-presets="suggestedPresets"
        :available-presets="availablePresets"
        :selected-presets="selectedPresets"
        :category-tabs="categoryTabs"
        @add-all-suggested="emit('add-all-suggested')"
        @toggle-preset="preset => emit('toggle-preset', preset)"
        @update:search-query="query => emit('update:searchQuery', query)"
        @update:selected-category="category => emit('update:selectedCategory', category)"
      />
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
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
  categoryTabs: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits({
  'update:searchQuery': query => typeof query === 'string',
  'update:selectedCategory': category => typeof category === 'string',
  'add-all-suggested': null,
  'toggle-preset': preset => Boolean(preset),
})

const showAccelerator = ref(false)
const isOpen = computed(() => showAccelerator.value)

const toggleOpen = () => {
  showAccelerator.value = !showAccelerator.value
}
</script>
