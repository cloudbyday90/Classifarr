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
      <div id="policy-builder-library-context">
        <PolicyBuilderLibraryContext
          :library="currentLibrary"
          :profile="libraryProfile"
          :genre-summary="libraryProfileGenreSummary"
          :freshness="libraryProfileFreshness"
          :refresh-result="libraryProfileRefreshResult"
          :loading="libraryProfileLoading"
          :refreshing="libraryProfileRefreshing"
          :can-refresh="Boolean(form.library_id)"
          @refresh-profile="refreshActiveLibraryProfile"
        />
      </div>

      <PolicyBuilderSetupCards :cards="setupCards" />

      <div id="policy-builder-routing-readiness">
        <PolicyBuilderRoutingReadinessCard :readiness="routingReadiness" />
      </div>

      <PolicyPresetMigrationNotice
        v-if="presetMigrationNotice"
        :notice="presetMigrationNotice"
        @dismiss="dismissPresetMigrationNotice"
      />

      <PolicyIntentSummaryCard :summary="intentSummary" />

      <PolicyIntentImpactPreviewCard
        v-if="showMigrationVerifierPanels"
        :preview="impactPreview"
        :notice="impactPreviewNotice"
        :changed-buckets="impactPreviewChangedBuckets"
        :loading="impactPreviewLoading"
        :disabled="!isValid"
        :stale="impactPreviewStale"
        :error="impactPreviewError"
        @preview="runImpactPreview"
      />

      <PolicyIntentReplayPreviewCard
        v-if="showMigrationVerifierPanels"
        v-model:tmdb-live-preview-opt-in="tmdbLivePreviewOptIn"
        :preview="replayPreview"
        :notice="replayPreviewNotice"
        :samples="replayPreviewSamples"
        :loading="replayPreviewLoading"
        :disabled="!isValid"
        :stale="replayPreviewStale"
        :error="replayPreviewError"
        @preview="runReplayPreview"
      />

      <div id="policy-builder-intent-editor">
        <PolicyIntentEditor
          :selected-presets="selectedPresets"
          :all-presets="allPresets"
          :intent-draft="intentDraft"
          :available-genres="availableGenres"
          :available-genre-options="availableGenreOptions"
          :available-ratings="availableRatings"
          @draft-add-signal="addIntentSignal"
          @draft-remove-signal-value="removeIntentSignalValue"
          @draft-set-signal-config="setIntentSignalConfig"
          @draft-clear-signal-config="clearIntentSignalConfig"
        />
      </div>

      <PolicyStarterTemplateMechanics
        v-model:search-query="searchQuery"
        v-model:selected-category="selectedCategory"
        :suggested-presets="suggestedPresets"
        :available-presets="filteredAvailablePresets"
        :selected-presets="selectedPresets"
        :all-presets="allPresets"
        :category-tabs="categoryTabs"
        :expanded-preset-ids="expandedPresetIds"
        :available-ratings="availableRatings"
        :available-genres="availableGenres"
        :combined-signals="combinedSignals"
        :get-preset-usage-count="getPresetUsageCount"
        :format-usage-label="formatUsageLabel"
        @add-all-suggested="addAllSuggested"
        @toggle-preset="togglePresetSelection"
        @toggle-preset-customize="togglePresetCustomize"
        @remove-preset="removePreset"
        @update-preset-weight="setPresetWeight"
        @add-custom-signal="addCustomSignal"
        @remove-custom-signal="removeCustomSignal"
        @set-signal-removal="setSignalRemoval"
        @set-signal-strict="setPresetSignalStrict"
      />

      <div class="border-t border-gray-700 my-4" />

      <div id="policy-builder-advanced-settings">
        <PolicyBuilderAdvancedSettings
          :form="form"
          :total-weight="totalWeight"
          @update-field="setFormField"
        />
      </div>
    </div>

    <template #footer>
      <PolicyBuilderFooterActions
        :boundary="saveBoundary"
        @defer="defer"
        @save="save"
      />
    </template>
  </Modal>
</template>

<script setup>
import { computed, onMounted, ref, toRef } from 'vue'
import Modal from '@/components/common/Modal.vue'
import PolicyBuilderAdvancedSettings from '@/components/policies/PolicyBuilderAdvancedSettings.vue'
import PolicyBuilderFooterActions from '@/components/policies/PolicyBuilderFooterActions.vue'
import PolicyIntentEditor from '@/components/policies/PolicyIntentEditor.vue'
import PolicyIntentSummaryCard from '@/components/policies/PolicyIntentSummaryCard.vue'
import PolicyBuilderLibraryContext from '@/components/policies/PolicyBuilderLibraryContext.vue'
import PolicyBuilderRoutingReadinessCard from '@/components/policies/PolicyBuilderRoutingReadinessCard.vue'
import PolicyBuilderSetupCards from '@/components/policies/PolicyBuilderSetupCards.vue'
import PolicyPresetMigrationNotice from '@/components/policies/PolicyPresetMigrationNotice.vue'
import PolicyIntentImpactPreviewCard from '@/components/policies/PolicyIntentImpactPreviewCard.vue'
import PolicyIntentReplayPreviewCard from '@/components/policies/PolicyIntentReplayPreviewCard.vue'
import PolicyStarterTemplateMechanics from '@/components/policies/PolicyStarterTemplateMechanics.vue'
import api from '@/api'
import { usePolicyBuilderCombinedSignals } from '@/composables/usePolicyBuilderCombinedSignals'
import { usePolicyIntentImpactPreview } from '@/composables/usePolicyIntentImpactPreview'
import { usePolicyIntentReplayPreview } from '@/composables/usePolicyIntentReplayPreview'
import { usePolicyBuilderReferenceData } from '@/composables/usePolicyBuilderReferenceData'
import { usePolicyBuilderState } from '@/composables/usePolicyBuilderState'
import { buildPolicyBuilderSaveBoundary } from '@/utils/policyBuilderActionBoundary'
import { buildPolicyBuilderRoutingReadiness } from '@/utils/policyBuilderRoutingReadiness'
import { buildPolicyBuilderSetupCardViewModels } from '@/utils/policyBuilderSetupCards'
import { buildPolicyIntentViewFromDraft } from '@/utils/policyIntentDraftView'
import { buildPolicyIntentSummary } from '@/utils/policyIntentSummary'

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
  showMigrationVerifierPanels: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits({
  'update:modelValue': value => typeof value === 'boolean',
  save: payload => Boolean(payload) && typeof payload === 'object' && !Array.isArray(payload),
  close: () => true,
})

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
  libraryProfile,
  libraryProfileLoading,
  libraryProfileRefreshing,
  libraryProfileRefreshResult,
  searchQuery,
  selectedCategory,
  presetMigrationNotice,
  categoryTabs,
  availableRatings,
  availableGenres,
  availableGenreOptions,
  libraryProfileGenreSummary,
  libraryProfileFreshness,
  getFilteredAvailablePresets,
  getPresetUsageCount,
  formatUsageLabel,
  loadInitialData,
  dismissPresetMigrationNotice,
  watchSuggestedPresets,
  watchLibraryProfile,
  refreshLibraryProfile,
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
  removeIntentSignalValue,
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

const intentSummary = computed(() => buildPolicyIntentSummary(
  buildPolicyIntentViewFromDraft(intentDraft.value),
))

const routingReadiness = computed(() => buildPolicyBuilderRoutingReadiness({
  library: currentLibrary.value,
  form: form.value,
}))

const setupCards = computed(() => buildPolicyBuilderSetupCardViewModels({
  library: currentLibrary.value,
  form: form.value,
  intentSummary: intentSummary.value,
  libraryProfileGenreSummary: libraryProfileGenreSummary.value,
  libraryProfileFreshness: libraryProfileFreshness.value,
  libraryProfileLoading: libraryProfileLoading.value,
  routingReadiness: routingReadiness.value,
  selectedPresets: selectedPresets.value,
}))

const saveBoundary = computed(() => buildPolicyBuilderSaveBoundary({
  form: form.value,
  selectedPresets: selectedPresets.value,
  totalWeight: totalWeight.value,
  hasExistingPresets: hasExistingPresets.value,
  routingReadiness: routingReadiness.value,
}))

const impactPreviewPayload = computed(() => buildSavePayload())
const tmdbLivePreviewOptIn = ref(false)

const {
  preview: impactPreview,
  notice: impactPreviewNotice,
  changedBuckets: impactPreviewChangedBuckets,
  loading: impactPreviewLoading,
  error: impactPreviewError,
  isStale: impactPreviewStale,
  runPreview: runImpactPreview,
} = usePolicyIntentImpactPreview({
  previewPolicyIntentImpact: api.previewPolicyIntentImpact,
  buildPayload: buildSavePayload,
  payloadSource: impactPreviewPayload,
})

const {
  preview: replayPreview,
  notice: replayPreviewNotice,
  samples: replayPreviewSamples,
  loading: replayPreviewLoading,
  error: replayPreviewError,
  isStale: replayPreviewStale,
  runPreview: runReplayPreview,
} = usePolicyIntentReplayPreview({
  previewPolicyIntentReplay: api.previewPolicyIntentReplay,
  buildPayload: buildSavePayload,
  payloadSource: impactPreviewPayload,
  tmdbLivePreviewOptIn,
})

// Filtered available presets (not yet selected)
const filteredAvailablePresets = computed(() => {
  return getFilteredAvailablePresets(selectedPresets.value)
})

onMounted(loadInitialData)

watchSuggestedPresets(computed(() => form.value.library_id))
watchLibraryProfile(computed(() => form.value.library_id))

const refreshActiveLibraryProfile = () => {
  refreshLibraryProfile(form.value.library_id)
}

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

const defer = () => {
  emit('close')
}

const save = async () => {
  if (!saveBoundary.value.canSave) return

  const policyData = buildSavePayload()

  try {
    await emit('save', policyData)
  } catch (error) {
    console.error('Failed to save policy:', error)
    alert('Failed to save policy: ' + error.message)
  }
}
</script>
