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
            :loading="libraryProfileLoading"
            :show-freshness="!experienceMode.isNativeView"
          />
        </div>

        <PolicyNativePolicySummary
          v-if="experienceMode.isNativeView"
          :policy="policy"
          :readiness-summary="nativeReadinessSummary"
          :loading="nativeReadinessLoading"
          :error="nativeReadinessError"
        />

        <PolicyNativePolicyRecoveryNotice v-else-if="experienceMode.isNativeRecovery" />

        <PolicyBuilderWorkflowShell
          v-if="experienceMode.isNativeCreate"
          :workflow-read="operatorWorkflowRead"
          :workflow-presentation="operatorWorkflowPresentation"
          :loading="operatorWorkflowLoading"
          :saving="saving"
          :error="operatorWorkflowError"
          :accepted-signals="acceptedIntentSignals"
          :constraint-draft-commands="constraintDraftCommands"
          :selection-enabled="experienceMode.isNativeCreate"
          :active-empty-state-action-id="activeEmptyStateActionId"
          :empty-state-action-feedback="emptyStateActionFeedback"
          :custom-entry-busy="customIntentSignalValidationLoading"
          :custom-entry-error="customIntentSignalValidationError"
          :custom-entry-message="customIntentSignalValidationMessage"
          @draft-command-plan="applyIntentSignalCommandPlan"
          @constraint-draft-command-plan="applyConstraintDraftCommandPlan"
          @clear-constraint-draft="resetConstraintDraft"
          @validate-custom-signal="validateActiveCustomIntentSignal"
          @empty-state-action="handleEmptyStateAction"
        />

        <PolicyCompatibilityMaintenanceSurface
          v-else-if="experienceMode.isLegacyEdit"
          :preset-migration-notice="presetMigrationNotice"
          :selected-presets="selectedPresets"
          :all-presets="allPresets"
          :intent-draft="intentDraft"
          :available-genres="availableGenres"
          :available-genre-options="availableGenreOptions"
          :available-ratings="availableRatings"
          :purpose-coverage-preflight="purposeCoveragePreflight"
          :purpose-coverage-preflight-loading="purposeCoveragePreflightLoading"
          :purpose-coverage-preflight-error="purposeCoveragePreflightError"
          :purpose-coverage-preflight-available="purposeCoveragePreflightAvailable"
          @dismiss-migration-notice="dismissPresetMigrationNotice"
          @draft-add-signal="addIntentSignal"
          @draft-remove-signal-value="removeIntentSignalValue"
          @draft-set-signal-config="setIntentSignalConfig"
          @draft-clear-signal-config="clearIntentSignalConfig"
          @preflight-purpose-coverage="preflightPurposeCoverage"
        />
      </template>
    </div>

    <template
      v-if="!nativeCreateHandoff && !experienceMode.isNativeView && !experienceMode.isNativeRecovery"
      #footer
    >
      <PolicyBuilderFooterActions
        :boundary="saveBoundary"
        :saving="saving"
        :save-feedback="saveFeedback"
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
import PolicyCompatibilityMaintenanceSurface from '@/components/policies/PolicyCompatibilityMaintenanceSurface.vue'
import PolicyBuilderFooterActions from '@/components/policies/PolicyBuilderFooterActions.vue'
import PolicyBuilderWorkflowShell from '@/components/policies/PolicyBuilderWorkflowShell.vue'
import PolicyNativeCreateHandoff from '@/components/policies/PolicyNativeCreateHandoff.vue'
import PolicyNativePolicyRecoveryNotice from '@/components/policies/PolicyNativePolicyRecoveryNotice.vue'
import PolicyNativePolicySummary from '@/components/policies/PolicyNativePolicySummary.vue'
import PolicyBuilderLibraryContext from '@/components/policies/PolicyBuilderLibraryContext.vue'
import { usePolicyBuilderReferenceData } from '@/composables/usePolicyBuilderReferenceData'
import { usePolicyBuilderState } from '@/composables/usePolicyBuilderState'
import { usePolicyOperatorWorkflow } from '@/composables/usePolicyOperatorWorkflow'
import { usePolicyNativeReadinessSummary } from '@/composables/usePolicyNativeReadinessSummary'
import { usePolicyIntentSignalDraft } from '@/composables/usePolicyIntentSignalDraft'
import { usePolicyIntentConstraintDraft } from '@/composables/usePolicyIntentConstraintDraft'
import { usePolicyNativeCreateAction } from '@/composables/usePolicyNativeCreateAction'
import { usePolicyNativeCreateHandoff } from '@/composables/usePolicyNativeCreateHandoff'
import { usePolicyPurposeCoveragePreflight } from '@/composables/usePolicyPurposeCoveragePreflight'
import { buildPolicyBuilderSaveBoundary } from '@/utils/policyBuilderActionBoundary'
import { buildPolicyBuilderExperienceMode } from '@/utils/policyBuilderExperienceMode'
import { clonePolicyIntentDraftForWrite } from '@/utils/policyIntentWritePreflight'
import { buildNativePolicyCreatePayload } from '@/utils/policyNativeCreatePayload'
import {
  POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS,
  POLICY_AUTHORING_ACTION_IDS,
  buildPolicyAuthoringActionFailureFeedback,
  buildPolicyAuthoringActionFeedback,
} from '@/utils/policyAuthoringActionFeedback'
import {
  clearRouteFocusHandoff,
  requestRouteFocusHandoff,
} from '@/utils/routeFocusHandoff'

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
  'native-policy-created': policyId => Number.isInteger(policyId) && policyId > 0,
  close: () => true,
})

const router = useRouter()
const compatibilitySaving = ref(false)
const compatibilitySaveFeedback = ref(null)
const nativeCreateHandoffRef = ref(null)
const activeEmptyStateActionId = ref('')
const emptyStateActionFeedback = ref(null)
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
  libraryProfile,
  libraryProfileLoading,
  presetMigrationNotice,
  availableRatings,
  availableGenres,
  availableGenreOptions,
  libraryProfileGenreSummary,
  libraryProfileFreshness,
  loadInitialData,
  loadLibraryContext,
  dismissPresetMigrationNotice,
  watchLibraryProfile,
} = referenceData

const {
  form,
  selectedPresets,
  intentDraft,
  currentLibrary,
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

const experienceMode = computed(() => buildPolicyBuilderExperienceMode(props.policy))

const {
  workflowRead: operatorWorkflowRead,
  workflowPresentation: operatorWorkflowPresentation,
  loading: operatorWorkflowLoading,
  error: operatorWorkflowError,
  watchWorkflow: watchOperatorWorkflow,
  customIntentSignalValidationLoading,
  customIntentSignalValidationError,
  customIntentSignalValidationMessage,
  validateCustomIntentSignal,
} = usePolicyOperatorWorkflow()

const {
  readinessSummary: nativeReadinessSummary,
  loading: nativeReadinessLoading,
  error: nativeReadinessError,
  watchSummary: watchNativeReadinessSummary,
} = usePolicyNativeReadinessSummary()

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

const {
  handoff: nativeCreateHandoff,
  establishHandoff: establishNativeCreateHandoff,
} = usePolicyNativeCreateHandoff()

const nativeCreateAction = usePolicyNativeCreateAction()

const {
  preflight: purposeCoveragePreflight,
  isLoading: purposeCoveragePreflightLoading,
  errorMessage: purposeCoveragePreflightError,
  reset: resetPurposeCoveragePreflight,
  runPreflight: runPurposeCoveragePreflight,
} = usePolicyPurposeCoveragePreflight()

const saving = computed(() => (
  experienceMode.value.isNativeCreate
    ? nativeCreateAction.pending.value
    : compatibilitySaving.value
))

const saveFeedback = computed(() => (
  experienceMode.value.isNativeCreate
    ? nativeCreateAction.feedback.value
    : compatibilitySaveFeedback.value
))

const saveBoundary = computed(() => buildPolicyBuilderSaveBoundary({
  form: form.value,
  hasExistingPolicy: experienceMode.value.isLegacyEdit,
  nativeIntentEstablishment: nativeIntentEstablishment.value,
}))

const purposeCoveragePreflightAvailable = computed(() => (
  experienceMode.value.isLegacyEdit
  && Number.isInteger(Number(props.policy?.id))
  && Number(props.policy.id) > 0
))

onMounted(() => {
  if (experienceMode.value.isLegacyEdit) {
    return loadInitialData()
  }

  return loadLibraryContext()
})

watchLibraryProfile(computed(() => form.value.library_id))
watchOperatorWorkflow(computed(() => (
  experienceMode.value.isNativeCreate ? form.value.library_id : null
)))
watchNativeReadinessSummary(computed(() => (
  experienceMode.value.isNativeView ? props.policy?.id : null
)))

watch(() => props.modelValue, isOpen => {
  if (isOpen) restoreFocusAfterClose.value = true
})

watch(intentDraft, () => {
  resetPurposeCoveragePreflight()
}, { deep: true })

const handleEmptyStateAction = async (emptyState) => {
  if (!experienceMode.value.isNativeCreate) return

  const actionId = emptyState?.nextAction?.actionId
  if (!actionId || activeEmptyStateActionId.value) return

  emptyStateActionFeedback.value = null
  if (actionId !== 'map_routing_destination') {
    emptyStateActionFeedback.value = buildPolicyAuthoringActionFeedback({
      actionId: POLICY_AUTHORING_ACTION_IDS.OPEN_LIBRARY_MAPPING,
      statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.UNAVAILABLE,
      message: 'This library action is unavailable. Review the current library setup from the policies page.',
    })
    return
  }

  const libraryId = Number(form.value.library_id)
  if (!Number.isInteger(libraryId) || libraryId <= 0) {
    emptyStateActionFeedback.value = buildPolicyAuthoringActionFeedback({
      actionId: POLICY_AUTHORING_ACTION_IDS.OPEN_LIBRARY_MAPPING,
      statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.UNAVAILABLE,
      message: 'Library mapping is unavailable until a valid destination library is selected.',
    })
    return
  }

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
      emptyStateActionFeedback.value = buildPolicyAuthoringActionFeedback({
        actionId: POLICY_AUTHORING_ACTION_IDS.OPEN_LIBRARY_MAPPING,
        statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.RETRYABLE_ERROR,
        message: 'Classifarr could not open the library mapping. Try again.',
      })
      return
    }

    restoreFocusAfterClose.value = false
    isOpen.value = false
  } catch {
    clearRouteFocusHandoff('LibraryDetail')
    emptyStateActionFeedback.value = buildPolicyAuthoringActionFeedback({
      actionId: POLICY_AUTHORING_ACTION_IDS.OPEN_LIBRARY_MAPPING,
      statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.RETRYABLE_ERROR,
      message: 'Classifarr could not open the library mapping. Try again.',
    })
  } finally {
    activeEmptyStateActionId.value = ''
  }
}

const validateActiveCustomIntentSignal = async (payload) => {
  if (!experienceMode.value.isNativeCreate) return false

  await validateCustomIntentSignal(form.value.library_id, payload)
}

const preflightPurposeCoverage = async () => {
  if (!purposeCoveragePreflightAvailable.value || purposeCoveragePreflightLoading.value) return

  const draft = clonePolicyIntentDraftForWrite(intentDraft.value)
  if (!draft) {
    resetPurposeCoveragePreflight()
    return
  }

  await runPurposeCoveragePreflight({
    policyId: Number(props.policy.id),
    draft,
  })
}

const defer = () => {
  emit('close')
}

const save = async () => {
  if (experienceMode.value.isNativeRecovery || !saveBoundary.value.canSave || saving.value) return

  const policyData = experienceMode.value.isNativeCreate
    ? buildNativePolicyCreatePayload({
      formValue: form.value,
      currentLibrary: currentLibrary.value,
      nativeIntentEstablishment: nativeIntentEstablishment.value,
    })
    : buildSavePayload()

  if (experienceMode.value.isNativeCreate) {
    nativeCreateAction.reset()

    if (selectedPresets.value.length > 0) {
      nativeCreateAction.setFeedback(buildPolicyAuthoringActionFeedback({
        actionId: POLICY_AUTHORING_ACTION_IDS.CREATE_NATIVE_POLICY,
        statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.REJECTED,
        message: 'Remove starter templates before creating a native intent policy from observed library values.',
      }))
      return
    }

    if (!policyData) {
      nativeCreateAction.setFeedback(buildPolicyAuthoringActionFeedback({
        actionId: POLICY_AUTHORING_ACTION_IDS.CREATE_NATIVE_POLICY,
        statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.REJECTED,
        message: 'Classifarr could not prepare this policy request. Review the selected destination values and try again.',
      }))
      return
    }

    const result = await nativeCreateAction.create(policyData)
    if (!result.accepted) return

    if (await establishNativeCreateHandoff(result.response)) {
      emit('native-policy-created', nativeCreateHandoff.value?.policy?.id)
      await nextTick()
      nativeCreateHandoffRef.value?.focus()
      return
    }

    nativeCreateAction.setFeedback(buildPolicyAuthoringActionFeedback({
      actionId: POLICY_AUTHORING_ACTION_IDS.CREATE_NATIVE_POLICY,
      statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.RETRYABLE_ERROR,
      message: 'Classifarr could not confirm the policy result. Try again to safely check the saved result.',
    }))
    return
  }

  compatibilitySaveFeedback.value = null
  compatibilitySaving.value = true

  try {
    if (props.submitPolicy) {
      await props.submitPolicy(policyData)
    } else {
      emit('save', policyData)
    }
  } catch (error) {
    compatibilitySaveFeedback.value = buildPolicyAuthoringActionFailureFeedback({
      actionId: POLICY_AUTHORING_ACTION_IDS.SAVE_COMPATIBILITY_POLICY,
      error,
    })
  } finally {
    compatibilitySaving.value = false
  }
}
</script>
