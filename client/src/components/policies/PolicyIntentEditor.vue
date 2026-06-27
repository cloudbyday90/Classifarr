<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section class="border border-primary/30 rounded-lg p-4 bg-primary/5 space-y-4">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h4 class="font-semibold flex items-center gap-2">
          <span class="text-primary">🧭</span>
          Policy Intent Builder
        </h4>
        <p class="text-xs text-gray-400 mt-1">
          Describe what should belong here without changing how existing policies save.
        </p>
        <p class="text-xs text-gray-400 mt-1 max-w-2xl">
          The media server shows how this library is used today. The policy explains what should belong going forward. Classifarr reconciles both.
        </p>
      </div>
      <div class="text-xs text-gray-400">
        {{ selectedPresets.length }} starter template{{ selectedPresets.length === 1 ? '' : 's' }}
      </div>
    </div>

    <div
      v-if="selectedPresets.length === 0"
      class="rounded-lg border border-gray-700 bg-background-light p-3 text-sm text-gray-400"
    >
      Select at least one starter template before editing policy intent.
    </div>

    <template v-else>
      <label class="block text-xs font-medium text-gray-300">
        Edit starter template
        <select
          v-model="activePresetId"
          class="mt-1 w-full px-2 py-1 bg-background border border-gray-700 rounded-sm text-sm"
        >
          <option
            v-for="preset in selectedPresets"
            :key="getPresetId(preset)"
            :value="getPresetId(preset)"
          >
            {{ preset.name }}
          </option>
        </select>
      </label>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div
          v-for="section in intentSections"
          :key="section.key"
          class="rounded-lg border border-gray-700 bg-background-light p-3 space-y-3"
        >
          <div>
            <div class="text-sm font-semibold text-white">
              {{ section.label }}
            </div>
            <p class="text-xs text-gray-400">
              {{ section.help }}
            </p>
          </div>

          <div class="flex flex-wrap gap-1">
            <span
              v-for="entry in section.entries"
              :key="entryKey(entry)"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs"
              :class="section.badgeClass"
            >
              {{ formatEntry(entry) }}
              <span class="text-gray-400">({{ entry.preset_name }})</span>
            </span>
            <span
              v-if="section.entries.length === 0"
              class="text-xs text-gray-500"
            >
              No configured signals.
            </span>
          </div>

          <div
            v-if="activePreset"
            class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2"
          >
            <select
              class="px-2 py-1 bg-background border border-gray-700 rounded-sm text-xs"
              @change="addSectionValue($event, section)"
            >
              <option value="">
                {{ section.addLabel }}
              </option>
              <option
                v-for="option in section.options"
                :key="section.key + '-' + option"
                :value="option"
              >
                {{ option }}
              </option>
            </select>
            <button
              v-if="section.hasClearAction"
              type="button"
              class="px-2 py-1 border border-gray-600 rounded-sm text-xs text-gray-300 hover:bg-gray-700"
              @click="clearSection(section)"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import {
  buildPolicyIntentView,
} from '@/utils/policyIntentModel'
import { buildPolicyIntentViewFromDraft } from '@/utils/policyIntentDraftView'
import {
  buildDraftClearCommandForIntentSection,
  buildDraftCommandForIntentSection,
  buildPolicyIntentEditorSections,
} from '@/utils/policyIntentEditorSections'

const props = defineProps({
  selectedPresets: {
    type: Array,
    default: () => [],
  },
  allPresets: {
    type: Array,
    default: () => [],
  },
  intentDraft: {
    type: Object,
    default: null,
  },
  availableGenres: {
    type: Array,
    default: () => [],
  },
  availableRatings: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits({
  'draft-add-signal': (payload) => {
    return Boolean(
      payload &&
      payload.presetId !== null &&
      payload.presetId !== undefined &&
      typeof payload.signalType === 'string' &&
      payload.signalType.length > 0 &&
      typeof payload.key === 'string',
    )
  },
  'draft-set-signal-config': (payload) => {
    return Boolean(
      payload &&
      payload.presetId !== null &&
      payload.presetId !== undefined &&
      typeof payload.signalType === 'string' &&
      payload.signalType.length > 0 &&
      payload.config &&
      typeof payload.config === 'object',
    )
  },
  'draft-clear-signal-config': (payload) => {
    return Boolean(
      payload &&
      payload.presetId !== null &&
      payload.presetId !== undefined &&
      typeof payload.signalType === 'string' &&
      payload.signalType.length > 0,
    )
  },
})

const activePresetId = ref(null)

const getPresetId = (preset) => preset?.preset_id ?? preset?.id ?? null

watch(
  () => props.selectedPresets.map(getPresetId),
  (presetIds) => {
    if (!presetIds.includes(activePresetId.value)) {
      activePresetId.value = presetIds[0] ?? null
    }
  },
  { immediate: true },
)

const activePreset = computed(() => {
  return props.selectedPresets.find((preset) => getPresetId(preset) === activePresetId.value) || null
})

const intentView = computed(() => {
  return props.intentDraft
    ? buildPolicyIntentViewFromDraft(props.intentDraft)
    : buildPolicyIntentView(props.selectedPresets, props.allPresets)
})

const emitDraftCommand = (command) => {
  if (!command) return
  emit(command.eventName, command.payload)
}

const addSectionValue = (event, section) => {
  const value = event.target.value
  event.target.value = ''

  if (!value || !activePreset.value) {
    return
  }

  emitDraftCommand(buildDraftCommandForIntentSection(section.key, {
    presetId: getPresetId(activePreset.value),
    value,
  }))
}

const clearSection = (section) => {
  if (!activePreset.value) return
  emitDraftCommand(buildDraftClearCommandForIntentSection(section.key, {
    presetId: getPresetId(activePreset.value),
  }))
}

const intentSections = computed(() => buildPolicyIntentEditorSections(intentView.value, {
  availableGenres: props.availableGenres,
  availableRatings: props.availableRatings,
}))

const entryKey = (entry) => {
  return [
    entry.role,
    entry.preset_id,
    entry.signal_type,
    JSON.stringify(entry.values),
  ].join(':')
}

const formatEntry = (entry) => {
  const values = entry.values || {}
  const list = values.require_any || values.require_all || values.prefer || values.include || values.exclude
  if (Array.isArray(list) && list.length > 0) {
    return `${entry.signal_type}: ${list.join(', ')}`
  }

  if (values.mode === 'max' && values.max) {
    return `${entry.signal_type}: max ${values.max}`
  }

  return entry.signal_type
}
</script>
