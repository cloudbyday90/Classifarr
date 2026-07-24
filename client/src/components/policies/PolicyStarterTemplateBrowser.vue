<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div
      v-if="suggestedPresets.length > 0"
      class="space-y-3"
    >
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-primary flex items-center gap-2">
          <span>✨</span> Suggested
        </h3>
        <button
          type="button"
          class="text-xs px-2 py-1 bg-blue-500/20 text-primary rounded-sm hover:bg-blue-500/30 transition-colors"
          @click="emit('add-all-suggested')"
        >
          + Add All
        </button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          v-for="preset in suggestedPresets"
          :key="'suggested-' + getPresetId(preset)"
          type="button"
          class="flex w-full items-center gap-3 p-3 text-left rounded-lg border-l-4 cursor-pointer transition-all hover:bg-gray-800"
          :class="isPresetSelected(preset)
            ? 'bg-green-500/10 border-success'
            : 'bg-blue-500/10 border-primary'"
          :aria-pressed="String(isPresetSelected(preset))"
          :aria-label="getTemplateActionLabel(preset)"
          @click="emit('toggle-preset', preset)"
        >
          <div
            v-if="isPresetSelected(preset)"
            class="shrink-0 w-5 h-5 rounded-full bg-success flex items-center justify-center"
          >
            <span class="text-white text-xs font-bold">✓</span>
          </div>
          <div
            v-else
            class="shrink-0 w-5 h-5 rounded-full border-2 border-gray-600 flex items-center justify-center hover:border-primary"
          >
            <span class="text-gray-500 text-xs">+</span>
          </div>
          <span class="text-lg">{{ preset.icon || '📦' }}</span>
          <div class="flex-1 min-w-0">
            <div class="font-medium truncate">
              {{ preset.name }}
            </div>
            <div class="text-xs text-gray-400">
              {{ preset.description || 'Optional template suggestion' }}
            </div>
            <div
              v-if="preset.source === 'custom'"
              class="text-[11px] text-blue-300"
            >
              My Preset
            </div>
          </div>
        </button>
      </div>
    </div>

    <div class="space-y-3">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="cat in categoryTabs"
          :key="cat.value"
          type="button"
          class="px-3 py-1.5 text-sm rounded-lg transition-colors"
          :class="selectedCategory === cat.value
            ? 'bg-primary text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
          @click="emit('update:selectedCategory', cat.value)"
        >
          {{ cat.label }}
          <span
            v-if="cat.count"
            class="text-xs opacity-70"
          >({{ cat.count }})</span>
        </button>
      </div>

      <input
        :value="searchQuery"
        type="search"
        placeholder="Search templates..."
        class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-primary focus:outline-hidden text-white placeholder-gray-500"
        @input="emit('update:searchQuery', $event.target.value)"
      >
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
      <button
        v-for="preset in availablePresets"
        :key="getPresetId(preset)"
        type="button"
        class="flex w-full items-center gap-3 p-3 text-left rounded-lg border cursor-pointer transition-all hover:bg-gray-800"
        :class="isPresetSelected(preset)
          ? 'bg-green-500/10 border-success'
          : 'bg-background-light border-gray-700'"
        :aria-pressed="String(isPresetSelected(preset))"
        :aria-label="getTemplateActionLabel(preset)"
        @click="emit('toggle-preset', preset)"
      >
        <div
          v-if="isPresetSelected(preset)"
          class="shrink-0 w-5 h-5 rounded-full bg-success flex items-center justify-center"
        >
          <span class="text-white text-xs font-bold">✓</span>
        </div>
        <div
          v-else
          class="shrink-0 w-5 h-5 rounded-full border-2 border-gray-600 flex items-center justify-center hover:border-primary"
        >
          <span class="text-gray-500 text-xs">+</span>
        </div>
        <span class="text-lg">{{ preset.icon || '📦' }}</span>
        <div class="flex-1 min-w-0">
          <div class="font-medium truncate">
            {{ preset.name }}
          </div>
          <div class="text-xs text-gray-400 truncate">
            {{ preset.description || preset.category }}
          </div>
        </div>
        <span
          v-if="preset.source === 'custom'"
          class="text-xs px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded-sm"
        >
          Custom
        </span>
      </button>

      <div
        v-if="availablePresets.length === 0"
        class="col-span-2 text-center py-8 text-gray-400"
      >
        No templates found matching your search
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
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
  selectedCategory: {
    type: String,
    default: 'all',
  },
  searchQuery: {
    type: String,
    default: '',
  },
})

const emit = defineEmits({
  'add-all-suggested': null,
  'toggle-preset': preset => Boolean(preset),
  'update:selectedCategory': category => typeof category === 'string',
  'update:searchQuery': query => typeof query === 'string',
})

const getPresetId = preset => preset?.preset_id ?? preset?.id ?? null

const getTemplateActionLabel = preset => {
  const name = preset?.name || 'starter template'
  return isPresetSelected(preset)
    ? `Remove ${name} template suggestion`
    : `Use ${name} template suggestion`
}

const selectedPresetIds = computed(() => new Set(
  props.selectedPresets
    .map(getPresetId)
    .filter(presetId => presetId !== null)
))

const isPresetSelected = preset => selectedPresetIds.value.has(getPresetId(preset))
</script>
