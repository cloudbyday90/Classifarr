<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div
    v-if="selectedPresets.length > 0"
    class="border border-gray-700 rounded-lg p-4"
  >
    <h4 class="font-semibold mb-3">
      Starter Templates ({{ selectedPresets.length }})
    </h4>
    <div class="space-y-3">
      <div
        v-for="preset in selectedPresets"
        :key="getPresetId(preset)"
        class="bg-background-light rounded-lg overflow-hidden"
      >
        <div class="flex items-center gap-3 text-sm p-3">
          <span class="text-lg">{{ preset.icon || '📦' }}</span>
          <span class="flex-1 font-medium">{{ preset.name }}</span>
          <span
            v-if="getPresetRuntimeBadge(preset)"
            class="text-[11px] px-2 py-0.5 rounded-full"
            :class="getPresetRuntimeBadge(preset).className"
          >
            {{ getPresetRuntimeBadge(preset).label }}
          </span>
          <button
            class="text-xs px-2 py-1 border rounded-sm hover:bg-gray-700"
            :class="isExpanded(preset) ? 'border-primary text-primary' : 'border-gray-600 text-gray-400'"
            @click="emit('toggle-preset-customize', getPresetId(preset))"
          >
            {{ isExpanded(preset) ? '▲ Close details' : '▼ Details' }}
          </button>
          <input
            :value="preset.weight"
            type="number"
            min="0.1"
            max="2"
            step="0.1"
            class="w-16 px-2 py-1 bg-background border border-gray-700 rounded-sm text-center text-sm"
            @change="emitWeightUpdate(preset, $event)"
          >
          <button
            class="text-red-400 hover:text-red-300 text-xl leading-none"
            @click="emit('remove-preset', getPresetId(preset))"
          >
            ×
          </button>
        </div>

        <PolicyStarterTemplateDetails
          v-if="isExpanded(preset)"
          :preset="preset"
          :all-presets="allPresets"
          :available-ratings="availableRatings"
          :available-genres="availableGenres"
          @add-custom-signal="payload => emit('add-custom-signal', payload)"
          @remove-custom-signal="payload => emit('remove-custom-signal', payload)"
          @set-signal-removal="payload => emit('set-signal-removal', payload)"
          @set-signal-strict="payload => emit('set-signal-strict', payload)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import PolicyStarterTemplateDetails from '@/components/policies/PolicyStarterTemplateDetails.vue'
import { usePolicyBuilderTemplateSignals } from '@/composables/usePolicyBuilderTemplateSignals'

const props = defineProps({
  selectedPresets: {
    type: Array,
    default: () => [],
  },
  expandedPresetIds: {
    type: [Object, Array],
    default: () => new Set(),
  },
  allPresets: {
    type: Array,
    default: () => [],
  },
  availableRatings: {
    type: Array,
    default: () => [],
  },
  availableGenres: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits([
  'toggle-preset-customize',
  'remove-preset',
  'update-preset-weight',
  'add-custom-signal',
  'remove-custom-signal',
  'set-signal-removal',
  'set-signal-strict',
])

const allPresetsRef = computed(() => props.allPresets)

const {
  getPresetRuntimeBadge,
} = usePolicyBuilderTemplateSignals({
  allPresets: allPresetsRef,
})

const getPresetId = (preset) => preset?.preset_id ?? preset?.id ?? null

const isExpanded = (preset) => {
  const presetId = getPresetId(preset)
  if (props.expandedPresetIds instanceof Set) {
    return props.expandedPresetIds.has(presetId)
  }
  if (Array.isArray(props.expandedPresetIds)) {
    return props.expandedPresetIds.includes(presetId)
  }
  return false
}

const emitWeightUpdate = (preset, event) => {
  emit('update-preset-weight', {
    presetId: getPresetId(preset),
    weight: event?.target?.value,
  })
}
</script>
