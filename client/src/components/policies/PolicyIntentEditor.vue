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
        <PolicyIntentSectionCard
          v-for="section in intentSections"
          :key="section.key"
          :section="section"
          :can-edit="Boolean(activePreset)"
          @add-value="addSectionValue"
          @clear-section="clearSection"
        />
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import PolicyIntentSectionCard from '@/components/policies/PolicyIntentSectionCard.vue'
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

const addSectionValue = ({ sectionKey, value }) => {
  if (!sectionKey || !value || !activePreset.value) {
    return
  }

  emitDraftCommand(buildDraftCommandForIntentSection(sectionKey, {
    presetId: getPresetId(activePreset.value),
    value,
  }))
}

const clearSection = (sectionKey) => {
  if (!activePreset.value) return
  emitDraftCommand(buildDraftClearCommandForIntentSection(sectionKey, {
    presetId: getPresetId(activePreset.value),
  }))
}

const intentSections = computed(() => buildPolicyIntentEditorSections(intentView.value, {
  availableGenres: props.availableGenres,
  availableRatings: props.availableRatings,
}))

</script>
