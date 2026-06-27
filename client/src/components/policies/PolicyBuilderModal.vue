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

      <div
        v-if="presetMigrationNotice"
        class="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-2"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-start gap-3">
            <span class="text-xl leading-none">⚠️</span>
            <div class="space-y-2">
              <div class="font-medium text-amber-200">
                Legacy preset attachments were auto-dropped after upgrade
              </div>
              <p class="text-sm text-amber-100/90">
                {{ presetMigrationNotice.summary }}
              </p>
              <p
                v-if="presetMigrationNotice.preview"
                class="text-xs text-amber-100/80"
              >
                {{ presetMigrationNotice.preview }}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="shrink-0 text-xs px-2 py-1 rounded-sm border border-amber-400/40 text-amber-200 hover:bg-amber-500/10"
            @click="dismissPresetMigrationNotice"
          >
            Dismiss
          </button>
        </div>
      </div>

      <!-- Suggested Presets Section -->
      <div
        v-if="suggestedPresets.length > 0"
        class="space-y-3"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-primary flex items-center gap-2">
            <span>✨</span> Suggested
          </h3>
          <button
            class="text-xs px-2 py-1 bg-blue-500/20 text-primary rounded-sm hover:bg-blue-500/30 transition-colors"
            @click="addAllSuggested"
          >
            + Add All
          </button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div
            v-for="preset in suggestedPresets"
            :key="'suggested-' + preset.id"
            class="flex items-center gap-3 p-3 rounded-lg border-l-4 cursor-pointer transition-all hover:bg-gray-800"
            :class="isPresetSelected(preset.id) 
              ? 'bg-green-500/10 border-success' 
              : 'bg-blue-500/10 border-primary'"
            @click="togglePresetSelection(preset)"
          >
            <div
              v-if="isPresetSelected(preset.id)"
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
                Suggestion score: {{ preset.suggestion_score ?? preset.match_score ?? 0 }}
              </div>
              <div
                v-if="preset.source === 'custom'"
                class="text-[11px] text-blue-300"
              >
                My Preset
              </div>
              <div
                v-if="hasRuntimeSemanticsWarning(preset)"
                class="text-[11px] text-amber-400"
              >
                Review runtime behavior
              </div>
              <div class="text-[11px] text-gray-500 truncate">
                {{ formatUsageLabel(getPresetUsageCount(preset)) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Category Tabs -->
      <div class="space-y-3">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="cat in categoryTabs"
            :key="cat.value"
            class="px-3 py-1.5 text-sm rounded-lg transition-colors"
            :class="selectedCategory === cat.value 
              ? 'bg-primary text-white' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
            @click="selectedCategory = cat.value"
          >
            {{ cat.label }} 
            <span
              v-if="cat.count"
              class="text-xs opacity-70"
            >({{ cat.count }})</span>
          </button>
        </div>

        <!-- Search -->
        <input 
          v-model="searchQuery"
          type="search"
          placeholder="Search presets..."
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-primary focus:outline-hidden text-white placeholder-gray-500"
        >
      </div>

      <!-- Preset Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
        <div
          v-for="preset in filteredAvailablePresets"
          :key="preset.id"
          class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-gray-800"
          :class="isPresetSelected(preset.id) 
            ? 'bg-green-500/10 border-success' 
            : 'bg-background-light border-gray-700'"
          @click="togglePresetSelection(preset)"
        >
          <div
            v-if="isPresetSelected(preset.id)"
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
            <div class="text-[11px] text-gray-500 truncate">
              {{ formatUsageLabel(getPresetUsageCount(preset)) }}
            </div>
          </div>
          <span 
            v-if="preset.source === 'custom'" 
            class="text-xs px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded-sm"
          >
            Custom
          </span>
        </div>
        
        <div
          v-if="filteredAvailablePresets.length === 0"
          class="col-span-2 text-center py-8 text-gray-400"
        >
          No presets found matching your search
        </div>
      </div>

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
import PolicySelectedStarterTemplates from '@/components/policies/PolicySelectedStarterTemplates.vue'
import { usePolicyBuilderCombinedSignals } from '@/composables/usePolicyBuilderCombinedSignals'
import { usePolicyBuilderReferenceData } from '@/composables/usePolicyBuilderReferenceData'
import { usePolicyBuilderState } from '@/composables/usePolicyBuilderState'
import { usePolicyBuilderTemplateSignals } from '@/composables/usePolicyBuilderTemplateSignals'

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
  isPresetSelected,
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
  hasRuntimeSemanticsWarning,
} = usePolicyBuilderTemplateSignals({
  allPresets,
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
