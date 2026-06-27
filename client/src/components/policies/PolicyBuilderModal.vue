<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <Modal
    v-model="isOpen"
    :title="modalTitle"
    class="max-w-6xl"
  >
    <div class="space-y-6">
      <!-- Library Context (read-only) with Lock Icon -->
      <div class="flex items-center gap-3 p-3 bg-background-light rounded-lg border border-gray-700">
        <span class="text-2xl">🔒</span>
        <div class="flex-1">
          <div class="text-sm text-gray-400">
            Library
          </div>
          <div class="font-medium">
            {{ currentLibrary?.name || 'Unknown Library' }}
          </div>
        </div>
      </div>

      <PolicyPresetMigrationNotice
        v-if="presetMigrationNotice"
        :notice="presetMigrationNotice"
        @dismiss="dismissPresetMigrationNotice"
      />

      <PolicyStarterTemplateBrowser
        v-model:search-query="searchQuery"
        v-model:selected-category="selectedCategory"
        :suggested-presets="suggestedPresets"
        :available-presets="filteredAvailablePresets"
        :selected-presets="selectedPresets"
        :all-presets="allPresets"
        :category-tabs="categoryTabs"
        :get-preset-usage-count="getPresetUsageCount"
        :format-usage-label="formatUsageLabel"
        @add-all-suggested="addAllSuggested"
        @toggle-preset="togglePresetSelection"
      />

      <div class="border-t border-gray-700 my-4" />

      <PolicyIntentEditor
        :selected-presets="selectedPresets"
        :all-presets="allPresets"
        :intent-draft="intentDraft"
        :available-genres="availableGenres"
        :available-ratings="availableRatings"
        @draft-add-signal="addIntentSignal"
        @draft-set-signal-config="setIntentSignalConfig"
        @draft-clear-signal-config="clearIntentSignalConfig"
      />

      <!-- Starter template details backed by legacy preset storage -->
      <div class="space-y-4">
        <PolicySelectedStarterTemplates
          :selected-presets="selectedPresets"
          :expanded-preset-ids="expandedPresetIds"
          :all-presets="allPresets"
          :available-ratings="availableRatings"
          :available-genres="availableGenres"
          @toggle-preset-customize="togglePresetCustomize"
          @remove-preset="removePreset"
          @update-preset-weight="setPresetWeight"
          @add-custom-signal="addCustomSignal"
          @remove-custom-signal="removeCustomSignal"
          @set-signal-removal="setSignalRemoval"
          @set-signal-strict="setPresetSignalStrict"
        />
        
        <PolicyCombinedSignalsSummary
          :preset-count="selectedPresets.length"
          :combined-signals="combinedSignals"
        />
      </div>

      <PolicyBuilderAdvancedSettings
        :form="form"
        :total-weight="totalWeight"
        @update-field="setFormField"
      />
    </div>

    <template #footer>
      <Button
        variant="ghost"
        @click="$emit('close')"
      >
        Cancel
      </Button>
      <Button
        variant="primary"
        :disabled="!isValid"
        @click="save"
      >
        {{ hasExistingPresets ? 'Save Policy' : 'Create Policy' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup>
import { computed, onMounted, toRef } from 'vue'
import Modal from '@/components/common/Modal.vue'
import Button from '@/components/common/Button.vue'
import PolicyBuilderAdvancedSettings from '@/components/policies/PolicyBuilderAdvancedSettings.vue'
import PolicyCombinedSignalsSummary from '@/components/policies/PolicyCombinedSignalsSummary.vue'
import PolicyIntentEditor from '@/components/policies/PolicyIntentEditor.vue'
import PolicyPresetMigrationNotice from '@/components/policies/PolicyPresetMigrationNotice.vue'
import PolicySelectedStarterTemplates from '@/components/policies/PolicySelectedStarterTemplates.vue'
import PolicyStarterTemplateBrowser from '@/components/policies/PolicyStarterTemplateBrowser.vue'
import { usePolicyBuilderCombinedSignals } from '@/composables/usePolicyBuilderCombinedSignals'
import { usePolicyBuilderReferenceData } from '@/composables/usePolicyBuilderReferenceData'
import { usePolicyBuilderState } from '@/composables/usePolicyBuilderState'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  policy: {
    type: Object,
    default: null,
  },
  libraryId: {
    type: Number,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue', 'save', 'close'])

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const modalTitle = computed(() => {
  const libraryName = currentLibrary.value?.name || 'New'
  return `${libraryName} Policy`
})

const referenceData = usePolicyBuilderReferenceData()
const {
  libraries,
  allPresets,
  suggestedPresets,
  searchQuery,
  selectedCategory,
  presetMigrationNotice,
  categoryTabs,
  availableRatings,
  availableGenres,
  getFilteredAvailablePresets,
  getPresetUsageCount,
  formatUsageLabel,
  loadInitialData,
  dismissPresetMigrationNotice,
  watchSuggestedPresets,
} = referenceData

const {
  form,
  selectedPresets,
  intentDraft,
  expandedPresetIds,
  totalWeight,
  currentLibrary,
  hasExistingPresets,
  isValid,
  togglePresetSelection,
  addAllSuggested: addPresetSuggestions,
  removePreset,
  togglePresetCustomize,
  setPresetWeight,
  setFormField,
  addCustomSignal: addDraftCustomSignal,
  removeCustomSignal: removeDraftCustomSignal,
  addIntentSignal,
  setIntentSignalConfig,
  setIntentSignalMetadata,
  setIntentSignalRemoval,
  clearIntentSignalConfig,
  buildSavePayload,
} = usePolicyBuilderState({
  policy: toRef(props, 'policy'),
  libraryId: toRef(props, 'libraryId'),
  libraries,
})

const {
  combinedSignals,
} = usePolicyBuilderCombinedSignals({
  selectedPresets,
  allPresets,
})

// Filtered available presets (not yet selected)
const filteredAvailablePresets = computed(() => {
  return getFilteredAvailablePresets(selectedPresets.value)
})

onMounted(loadInitialData)

watchSuggestedPresets(computed(() => form.value.library_id))

const addAllSuggested = () => {
  addPresetSuggestions(suggestedPresets.value)
}

const getSelectedPresetId = (preset) => preset?.preset_id ?? preset?.id ?? null

const addCustomSignal = ({ preset, signalType, key, value }) => {
  if (!key || !value) return

  addDraftCustomSignal({
    presetId: getSelectedPresetId(preset),
    signalType,
    key,
    value,
  })
}

const removeCustomSignal = ({ preset, signalType, key, value }) => {
  removeDraftCustomSignal({
    presetId: getSelectedPresetId(preset),
    signalType,
    key,
    value,
  })
}

const setPresetSignalStrict = ({ preset, signalType, strict, baseStrict = false }) => {
  setIntentSignalMetadata({
    presetId: getSelectedPresetId(preset),
    signalType,
    metadata: { strict },
    baseMetadata: {
      strict: baseStrict,
    },
  })
}

const setSignalRemoval = ({ preset, signalType, key, value, removed }) => {
  setIntentSignalRemoval({
    presetId: getSelectedPresetId(preset),
    signalType,
    key,
    value,
    removed,
  })
}

const save = async () => {
  if (!isValid.value) return

  const policyData = buildSavePayload()

  try {
    await emit('save', policyData)
  } catch (error) {
    console.error('Failed to save policy:', error)
    alert('Failed to save policy: ' + error.message)
  }
}
</script>
