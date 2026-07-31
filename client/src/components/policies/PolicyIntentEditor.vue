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
        {{ selectedPresets.length }} existing policy context{{ selectedPresets.length === 1 ? '' : 's' }}
      </div>
    </div>

    <div
      v-if="selectedPresets.length === 0"
      id="policy-builder-destination-rules"
      tabindex="-1"
      class="rounded-lg border border-gray-700 bg-background-light p-3 text-sm text-gray-400"
      aria-label="Destination rules unavailable"
    >
      This existing policy has no editable compatibility context. New policy
      intent is established from the connected library, not by attaching a
      starter template.
    </div>

    <template v-else>
      <section
        id="policy-builder-review-behavior"
        class="rounded-lg border border-gray-700 bg-background-light p-3 space-y-3"
        aria-labelledby="policy-builder-review-behavior-title"
      >
        <div>
          <h5
            id="policy-builder-review-behavior-title"
            class="text-sm font-semibold text-white"
          >
            {{ reviewBehaviorGroup.title }}
          </h5>
          <p class="text-xs text-gray-400">
            {{ reviewBehaviorGroup.help }}
          </p>
        </div>
        <div
          v-for="section in reviewBehaviorGroup.sections"
          :id="sectionElementId(section.key)"
          :key="section.key"
          class="rounded-lg"
        >
          <PolicyIntentSectionCard
            :section="section"
            :can-edit="Boolean(activePreset)"
            @add-value="addSectionValue"
            @clear-section="clearSection"
            @remove-entry="removeSectionEntry"
          />
        </div>
      </section>

      <label class="block text-xs font-medium text-gray-300">
        Edit existing policy context
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

      <div class="space-y-4">
        <section
          v-for="group in editableGroups"
          :id="group.targetId"
          :key="group.id"
          class="rounded-lg border border-gray-700 bg-background/40 p-3 space-y-3"
          :aria-labelledby="`${group.targetId}-title`"
        >
          <div>
            <h5
              :id="`${group.targetId}-title`"
              class="text-sm font-semibold text-white"
            >
              {{ group.title }}
            </h5>
            <p class="text-xs text-gray-400">
              {{ group.help }}
            </p>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div
              v-for="section in group.sections"
              :id="sectionElementId(section.key)"
              :key="section.key"
              class="rounded-lg"
            >
              <PolicyIntentSectionCard
                :section="section"
                :can-edit="Boolean(activePreset)"
                @add-value="addSectionValue"
                @clear-section="clearSection"
                @remove-entry="removeSectionEntry"
              />
            </div>
          </div>
        </section>
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
  buildDraftRemoveCommandForIntentEntry,
  buildPolicyIntentEditorSections,
} from '@/utils/policyIntentEditorSections'
import {
  POLICY_INTENT_EDITOR_GROUP_IDS,
  buildPolicyIntentEditorGroups,
} from '@/utils/policyIntentEditorGroups'
import { listPolicyReviewTriggerOptions } from '@/utils/policyReviewTriggers'

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
  availableGenreOptions: {
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
  'draft-remove-signal-value': (payload) => {
    return Boolean(
      payload &&
      payload.presetId !== null &&
      payload.presetId !== undefined &&
      typeof payload.signalType === 'string' &&
      payload.signalType.length > 0 &&
      typeof payload.key === 'string' &&
      payload.key.length > 0 &&
      payload.value !== null &&
      payload.value !== undefined,
    )
  },
})

const activePresetId = ref(null)

const getPresetId = (preset) => preset?.preset_id ?? preset?.id ?? null

const sectionElementId = sectionKey => `policy-intent-section-${sectionKey}`

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

  const currentSection = intentSections.value.find(section => section.key === sectionKey)
  emitDraftCommand(buildDraftCommandForIntentSection(sectionKey, {
    presetId: getPresetId(activePreset.value),
    value,
    currentEntries: currentSection?.entries,
  }))
}

const clearSection = (sectionKey) => {
  if (!activePreset.value) return
  emitDraftCommand(buildDraftClearCommandForIntentSection(sectionKey, {
    presetId: getPresetId(activePreset.value),
  }))
}

const removeSectionEntry = ({ sectionKey, entry }) => {
  emitDraftCommand(buildDraftRemoveCommandForIntentEntry(sectionKey, {
    presetId: getPresetId(activePreset.value),
    entry,
  }))
}

const intentSections = computed(() => buildPolicyIntentEditorSections(intentView.value, {
  availableGenres: props.availableGenres,
  availableGenreOptions: props.availableGenreOptions,
  availableRatings: props.availableRatings,
  availableReviewTriggers: listPolicyReviewTriggerOptions(),
}))

const intentSectionGroups = computed(() => buildPolicyIntentEditorGroups(intentSections.value))

const reviewBehaviorGroup = computed(() => {
  return intentSectionGroups.value.find(group => group.id === POLICY_INTENT_EDITOR_GROUP_IDS.REVIEW_BEHAVIOR)
})

const editableGroups = computed(() => {
  return intentSectionGroups.value.filter(group => group.id !== POLICY_INTENT_EDITOR_GROUP_IDS.REVIEW_BEHAVIOR)
})

</script>
