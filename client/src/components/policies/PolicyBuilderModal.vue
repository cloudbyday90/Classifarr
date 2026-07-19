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

      <PolicyBuilderWorkflowShell
        :workflow-read="operatorWorkflowRead"
        :loading="operatorWorkflowLoading"
        :error="operatorWorkflowError"
        :accepted-candidates="acceptedObservedCandidates"
        :selection-enabled="experienceMode.isNativeCreate"
        @draft-command-plan="applyObservedSuggestionCommandPlan"
      />

      <template v-if="experienceMode.isLegacyEdit">
        <PolicyPresetMigrationNotice
          v-if="presetMigrationNotice"
          :notice="presetMigrationNotice"
          @dismiss="dismissPresetMigrationNotice"
        />

        <PolicyIntentSummaryCard :summary="intentSummary" />

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

        <PolicyStarterTemplateAccelerator
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
      </template>
    </div>

    <template #footer>
      <PolicyBuilderFooterActions
        :boundary="saveBoundary"
        :saving="saving"
        :save-error="saveError"
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
import PolicyBuilderWorkflowShell from '@/components/policies/PolicyBuilderWorkflowShell.vue'
import PolicyIntentEditor from '@/components/policies/PolicyIntentEditor.vue'
import PolicyIntentSummaryCard from '@/components/policies/PolicyIntentSummaryCard.vue'
import PolicyBuilderLibraryContext from '@/components/policies/PolicyBuilderLibraryContext.vue'
import PolicyPresetMigrationNotice from '@/components/policies/PolicyPresetMigrationNotice.vue'
import PolicyStarterTemplateAccelerator from '@/components/policies/PolicyStarterTemplateAccelerator.vue'
import { usePolicyBuilderCombinedSignals } from '@/composables/usePolicyBuilderCombinedSignals'
import { usePolicyBuilderReferenceData } from '@/composables/usePolicyBuilderReferenceData'
import { usePolicyBuilderState } from '@/composables/usePolicyBuilderState'
import { usePolicyOperatorWorkflow } from '@/composables/usePolicyOperatorWorkflow'
import { usePolicyObservedSuggestionDraft } from '@/composables/usePolicyObservedSuggestionDraft'
import { buildPolicyBuilderSaveBoundary } from '@/utils/policyBuilderActionBoundary'
import { buildPolicyBuilderRoutingReadiness } from '@/utils/policyBuilderRoutingReadiness'
import { buildPolicyBuilderExperienceMode } from '@/utils/policyBuilderExperienceMode'
import { buildPolicyIntentViewFromDraft } from '@/utils/policyIntentDraftView'
import { buildPolicyIntentSummary } from '@/utils/policyIntentSummary'
import { useToast } from '@/stores/toast'

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
  submitPolicy: {
    type: Function,
    default: null,
  },
})

const emit = defineEmits({
  'update:modelValue': value => typeof value === 'boolean',
  save: payload => Boolean(payload) && typeof payload === 'object' && !Array.isArray(payload),
  close: () => true,
})

const toast = useToast()
const saving = ref(false)
const saveError = ref('')

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
  loadLibraryContext,
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

const {
  workflowRead: operatorWorkflowRead,
  loading: operatorWorkflowLoading,
  error: operatorWorkflowError,
  loadWorkflow: loadOperatorWorkflow,
  watchWorkflow: watchOperatorWorkflow,
} = usePolicyOperatorWorkflow()

const {
  acceptedCandidates: acceptedObservedCandidates,
  nativeIntentEstablishment,
  applyCommandPlan: applyObservedSuggestionCommandPlan,
} = usePolicyObservedSuggestionDraft({
  libraryId: computed(() => form.value.library_id),
})

const experienceMode = computed(() => buildPolicyBuilderExperienceMode(props.policy))

const saveBoundary = computed(() => buildPolicyBuilderSaveBoundary({
  form: form.value,
  selectedPresets: selectedPresets.value,
  totalWeight: totalWeight.value,
  hasExistingPolicy: experienceMode.value.isLegacyEdit,
  nativeIntentEstablishment: nativeIntentEstablishment.value,
  routingReadiness: routingReadiness.value,
}))

// Filtered available presets (not yet selected)
const filteredAvailablePresets = computed(() => {
  return getFilteredAvailablePresets(selectedPresets.value)
})

onMounted(() => {
  if (experienceMode.value.isLegacyEdit) {
    return loadInitialData()
  }

  return loadLibraryContext()
})

if (experienceMode.value.isLegacyEdit) {
  watchSuggestedPresets(computed(() => form.value.library_id))
}
watchLibraryProfile(computed(() => form.value.library_id))
watchOperatorWorkflow(computed(() => form.value.library_id))

const refreshActiveLibraryProfile = async () => {
  const refreshed = await refreshLibraryProfile(form.value.library_id)
  if (refreshed) {
    await loadOperatorWorkflow(form.value.library_id)
  }
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
  if (!saveBoundary.value.canSave || saving.value) return

  const policyData = buildSavePayload()
  if (experienceMode.value.isNativeCreate) {
    if (selectedPresets.value.length > 0) {
      const message = 'Remove starter templates before creating a native intent policy from observed library values.'
      saveError.value = message
      toast.error(message, 'Unable to save policy')
      return
    }

    delete policyData.policyIntentDraft
    policyData.native_intent_establishment = nativeIntentEstablishment.value
  }

  saveError.value = ''
  saving.value = true

  try {
    if (props.submitPolicy) {
      await props.submitPolicy(policyData)
    } else {
      emit('save', policyData)
    }
  } catch (error) {
    const message = error?.response?.data?.error || error?.message || 'Failed to save policy'
    saveError.value = message
    toast.error(message, 'Failed to save policy')
  } finally {
    saving.value = false
  }
}
</script>
