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
    :restore-focus="restoreFocusAfterClose"
    class="max-w-6xl"
  >
    <div class="space-y-6">
      <PolicyNativeCreateHandoff
        v-if="nativeCreateHandoff"
        ref="nativeCreateHandoffRef"
        :handoff="nativeCreateHandoff"
        @done="defer"
      />

      <template v-else>
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
            :show-refresh-action="experienceMode.isLegacyEdit"
            @refresh-profile="refreshActiveLibraryProfile"
          />
        </div>

        <PolicyBuilderWorkflowShell
          ref="workflowShellRef"
          :workflow-read="operatorWorkflowRead"
          :loading="operatorWorkflowLoading"
          :error="operatorWorkflowError"
          :refresh-result="libraryProfileRefreshResult"
          :refreshing="libraryProfileRefreshing"
          :accepted-signals="acceptedIntentSignals"
          :constraint-draft-commands="constraintDraftCommands"
          :selection-enabled="experienceMode.isNativeCreate"
          :active-empty-state-action-id="emptyStateActionBusyId"
          :active-empty-state-action-message="emptyStateActionBusyMessage"
          :custom-entry-busy="customIntentSignalValidationLoading"
          :custom-entry-error="customIntentSignalValidationError"
          :custom-entry-message="customIntentSignalValidationMessage"
          @draft-command-plan="applyIntentSignalCommandPlan"
          @constraint-draft-command-plan="applyConstraintDraftCommandPlan"
          @clear-constraint-draft="resetConstraintDraft"
          @validate-custom-signal="validateActiveCustomIntentSignal"
          @refresh-profile="refreshActiveLibraryProfile"
          @reload-workflow="reloadActiveLibraryWorkflow"
          @empty-state-action="handleEmptyStateAction"
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
            :category-tabs="categoryTabs"
            @add-all-suggested="addAllSuggested"
            @toggle-preset="togglePresetSelection"
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
      </template>
    </div>

    <template
      v-if="!nativeCreateHandoff"
      #footer
    >
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
import { computed, nextTick, onMounted, ref, toRef, watch } from 'vue'
import { isNavigationFailure, useRouter } from 'vue-router'
import Modal from '@/components/common/Modal.vue'
import PolicyBuilderAdvancedSettings from '@/components/policies/PolicyBuilderAdvancedSettings.vue'
import PolicyBuilderFooterActions from '@/components/policies/PolicyBuilderFooterActions.vue'
import PolicyBuilderWorkflowShell from '@/components/policies/PolicyBuilderWorkflowShell.vue'
import PolicyNativeCreateHandoff from '@/components/policies/PolicyNativeCreateHandoff.vue'
import PolicyIntentEditor from '@/components/policies/PolicyIntentEditor.vue'
import PolicyIntentSummaryCard from '@/components/policies/PolicyIntentSummaryCard.vue'
import PolicyBuilderLibraryContext from '@/components/policies/PolicyBuilderLibraryContext.vue'
import PolicyPresetMigrationNotice from '@/components/policies/PolicyPresetMigrationNotice.vue'
import PolicyStarterTemplateAccelerator from '@/components/policies/PolicyStarterTemplateAccelerator.vue'
import { usePolicyBuilderReferenceData } from '@/composables/usePolicyBuilderReferenceData'
import { usePolicyBuilderLibrarySync } from '@/composables/usePolicyBuilderLibrarySync'
import { usePolicyBuilderState } from '@/composables/usePolicyBuilderState'
import { usePolicyOperatorWorkflow } from '@/composables/usePolicyOperatorWorkflow'
import { usePolicyIntentSignalDraft } from '@/composables/usePolicyIntentSignalDraft'
import { usePolicyIntentConstraintDraft } from '@/composables/usePolicyIntentConstraintDraft'
import { usePolicyNativeCreateHandoff } from '@/composables/usePolicyNativeCreateHandoff'
import { usePolicyRecoveryFocus } from '@/composables/usePolicyRecoveryFocus'
import { buildPolicyBuilderSaveBoundary } from '@/utils/policyBuilderActionBoundary'
import { buildPolicyBuilderRoutingReadiness } from '@/utils/policyBuilderRoutingReadiness'
import { buildPolicyBuilderExperienceMode } from '@/utils/policyBuilderExperienceMode'
import { buildPolicyIntentViewFromDraft } from '@/utils/policyIntentDraftView'
import { buildPolicyIntentSummary } from '@/utils/policyIntentSummary'
import {
  clearRouteFocusHandoff,
  requestRouteFocusHandoff,
} from '@/utils/routeFocusHandoff'
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
const router = useRouter()
const saving = ref(false)
const saveError = ref('')
const nativeCreateHandoffRef = ref(null)
const activeEmptyStateActionId = ref('')
const workflowShellRef = ref(null)
const restoreFocusAfterClose = ref(true)

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const modalTitle = computed(() => {
  if (nativeCreateHandoff.value) return 'Policy created'

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
  loadInitialData,
  loadLibraryContext,
  loadLibraryProfile,
  dismissPresetMigrationNotice,
  watchSuggestedPresets,
  watchLibraryProfile,
  refreshLibraryProfile,
} = referenceData

const {
  form,
  selectedPresets,
  intentDraft,
  totalWeight,
  currentLibrary,
  togglePresetSelection,
  addAllSuggested: addPresetSuggestions,
  setFormField,
  addIntentSignal,
  removeIntentSignalValue,
  setIntentSignalConfig,
  clearIntentSignalConfig,
  buildSavePayload,
} = usePolicyBuilderState({
  policy: toRef(props, 'policy'),
  libraryId: toRef(props, 'libraryId'),
  libraries,
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
  customIntentSignalValidationLoading,
  customIntentSignalValidationError,
  customIntentSignalValidationMessage,
  validateCustomIntentSignal,
} = usePolicyOperatorWorkflow()

const constraintValueEligibility = computed(() => (
  operatorWorkflowRead.value?.constraintValueEligibility || null
))

const {
  acceptedSignals: acceptedIntentSignals,
  nativeIntentEstablishment,
  applyCommandPlan: applyIntentSignalCommandPlan,
} = usePolicyIntentSignalDraft({
  libraryId: computed(() => form.value.library_id),
})

const {
  constraintDraftCommands,
  applyCommandPlan: applyConstraintDraftCommandPlan,
  reset: resetConstraintDraft,
} = usePolicyIntentConstraintDraft({
  libraryId: computed(() => form.value.library_id),
  constraintValueEligibility,
})

const experienceMode = computed(() => buildPolicyBuilderExperienceMode(props.policy))

const {
  handoff: nativeCreateHandoff,
  establishHandoff: establishNativeCreateHandoff,
} = usePolicyNativeCreateHandoff()

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

watch(() => props.modelValue, isOpen => {
  if (isOpen) restoreFocusAfterClose.value = true
})

const {
  captureRecoveryFocus,
  restoreRecoveryFocus,
} = usePolicyRecoveryFocus({ workflowShellRef })

const refreshActiveLibraryProfile = async () => {
  const recoveryFocusTrigger = captureRecoveryFocus()
  try {
    const refreshed = await refreshLibraryProfile(form.value.library_id)
    if (refreshed) {
      await loadOperatorWorkflow(form.value.library_id)
    }
  } finally {
    await restoreRecoveryFocus(recoveryFocusTrigger)
  }
}

const {
  syncAndRefreshProfile,
} = usePolicyBuilderLibrarySync({ refreshProfile: refreshLibraryProfile })

const emptyStateActionBusyId = computed(() => (
  activeEmptyStateActionId.value || (
    libraryProfileRefreshing.value ? 'refresh_library_profile' : ''
  )
))
const emptyStateActionBusyMessage = computed(() => (
  !activeEmptyStateActionId.value && libraryProfileRefreshing.value
    ? 'Classifarr is refreshing library evidence.'
    : ''
))

const handleEmptyStateAction = async (emptyState) => {
  const actionId = emptyState?.nextAction?.actionId
  if (!actionId || activeEmptyStateActionId.value) return

  if (actionId === 'sync_media_server_library') {
    activeEmptyStateActionId.value = actionId
    const recoveryFocusTrigger = captureRecoveryFocus()
    try {
      const synced = await syncAndRefreshProfile(form.value.library_id)
      if (!synced) {
        toast.error('Classifarr could not sync this library and refresh its profile.')
        return
      }

      await loadOperatorWorkflow(form.value.library_id)
      toast.success('Library sync and profile refresh completed.')
    } finally {
      activeEmptyStateActionId.value = ''
      await restoreRecoveryFocus(recoveryFocusTrigger)
    }
    return
  }

  if (actionId === 'map_routing_destination') {
    const libraryId = Number(form.value.library_id)
    if (!Number.isInteger(libraryId) || libraryId <= 0) return

    activeEmptyStateActionId.value = actionId
    try {
      requestRouteFocusHandoff({
        routeName: 'LibraryDetail',
        targetId: 'library-arr-mapping',
        fallbackTargetId: 'library-detail-title',
      })
      const navigationFailure = await router.push({
        name: 'LibraryDetail',
        params: { id: libraryId },
      })
      const routeName = router.currentRoute?.value?.name
      if (isNavigationFailure(navigationFailure) || (routeName && routeName !== 'LibraryDetail')) {
        clearRouteFocusHandoff('LibraryDetail')
        toast.error('Classifarr could not open the library mapping.')
        return
      }

      restoreFocusAfterClose.value = false
      isOpen.value = false
    } catch {
      clearRouteFocusHandoff('LibraryDetail')
      toast.error('Classifarr could not open the library mapping.')
    } finally {
      activeEmptyStateActionId.value = ''
    }
  }
}

const reloadActiveLibraryWorkflow = async () => {
  const recoveryFocusTrigger = captureRecoveryFocus()
  try {
    await loadLibraryProfile(form.value.library_id)
    await loadOperatorWorkflow(form.value.library_id)
  } finally {
    await restoreRecoveryFocus(recoveryFocusTrigger)
  }
}

const validateActiveCustomIntentSignal = async (payload) => {
  await validateCustomIntentSignal(form.value.library_id, payload)
}

const addAllSuggested = () => {
  addPresetSuggestions(suggestedPresets.value)
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
    let response
    if (props.submitPolicy) {
      response = await props.submitPolicy(policyData)
    } else {
      emit('save', policyData)
    }

    if (experienceMode.value.isNativeCreate && await establishNativeCreateHandoff(response)) {
      await nextTick()
      nativeCreateHandoffRef.value?.focus()
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
