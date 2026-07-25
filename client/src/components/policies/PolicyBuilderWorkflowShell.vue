<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    class="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-4"
    aria-labelledby="policy-builder-workflow-title"
    :aria-busy="loading"
  >
    <DestinationContextCard
      :title="destinationTitle"
      :summary="destinationSummary"
    />

    <PolicyBuilderWorkflowStatusNotice :status="workflowStatus" />

    <template v-if="error">
      <PolicyNativeEvidenceRecovery
        v-if="selectionEnabled && nativeEvidenceRecovery.requiresAction"
        :recovery="nativeEvidenceRecovery"
        :refreshing="refreshing"
        :announce="false"
        @refresh-profile="emit('refresh-profile')"
        @reload-workflow="emit('reload-workflow')"
      />
    </template>

    <template v-else-if="!loading && workflowRead">
      <ObservedProfileSummary
        :library-name="libraryName"
        :observed-profile="observedProfile"
        :suggestions="observedSuggestions"
        :selection-enabled="selectionEnabled"
      />

      <PolicyBuilderDestinationQuestions
        :sections="sections"
        :selection-enabled="selectionEnabled"
        :native-evidence-recovery="nativeEvidenceRecovery"
        :refreshing="refreshing"
        :accepted-signals="acceptedSignals"
        :observed-evidence="observedEvidence"
        :intent-signal-options="intentSignalOptions"
        :library-name="libraryName"
        :custom-entry-input="customEntryInput"
        :custom-entry-busy="customEntryBusy"
        :custom-entry-error="customEntryError"
        :custom-entry-message="customEntryMessage"
        :empty-states="emptyStates"
        :active-empty-state-action-id="activeEmptyStateActionId"
        :active-empty-state-status-id="emptyStateActionStatusId"
        @draft-command-plan="emit('draft-command-plan', $event)"
        @validate-custom-signal="emit('validate-custom-signal', $event)"
        @refresh-profile="emit('refresh-profile')"
        @reload-workflow="emit('reload-workflow')"
        @empty-state-action="emit('empty-state-action', $event)"
      />

      <PolicyIntentConstraintControlSurface
        v-if="selectionEnabled && constraintDecisionModel"
        :constraint-decision-model="constraintDecisionModel"
        :constraint-value-eligibility="constraintValueEligibility"
        :constraint-draft-commands="constraintDraftCommands"
        @draft-command-plan="emit('constraint-draft-command-plan', $event)"
        @clear-constraint-draft="emit('clear-constraint-draft')"
      />

      <ReadinessNextActionCard
        v-if="!selectionEnabled"
        :readiness="workflow.readiness"
      />
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import DestinationContextCard from './DestinationContextCard.vue'
import ObservedProfileSummary from './ObservedProfileSummary.vue'
import PolicyBuilderDestinationQuestions from './PolicyBuilderDestinationQuestions.vue'
import PolicyNativeEvidenceRecovery from './PolicyNativeEvidenceRecovery.vue'
import PolicyBuilderWorkflowStatusNotice from './PolicyBuilderWorkflowStatusNotice.vue'
import PolicyIntentConstraintControlSurface from './PolicyIntentConstraintControlSurface.vue'
import ReadinessNextActionCard from './ReadinessNextActionCard.vue'
import { buildPolicyNativeEvidenceRecovery } from '@/utils/policyNativeEvidenceRecovery'
import { buildPolicyBuilderWorkflowStatus } from '@/utils/policyBuilderWorkflowStatusPriority'

const props = defineProps({
  workflowRead: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
  refreshResult: {
    type: Object,
    default: null,
  },
  refreshing: {
    type: Boolean,
    default: false,
  },
  acceptedSignals: {
    type: Array,
    default: () => [],
  },
  constraintDraftCommands: {
    type: Array,
    default: () => [],
  },
  selectionEnabled: {
    type: Boolean,
    default: false,
  },
  activeEmptyStateActionId: {
    type: String,
    default: '',
  },
  activeEmptyStateActionMessage: {
    type: String,
    default: '',
  },
  customEntryBusy: {
    type: Boolean,
    default: false,
  },
  customEntryError: {
    type: String,
    default: '',
  },
  customEntryMessage: {
    type: String,
    default: '',
  },
})

const emit = defineEmits({
  'draft-command-plan': plan => Boolean(plan?.commands?.length),
  'constraint-draft-command-plan': plan => Boolean(plan?.commands?.length),
  'clear-constraint-draft': () => true,
  'validate-custom-signal': payload => Boolean(payload?.signalType && payload?.value && payload?.explanation),
  'refresh-profile': () => true,
  'reload-workflow': () => true,
  'empty-state-action': emptyState => Boolean(emptyState?.stateId && emptyState?.nextAction?.actionId),
})

const workflow = computed(() => props.workflowRead?.workflow || null)
const observedProfile = computed(() => props.workflowRead?.observedProfile || {})
const intentSignalProjection = computed(() => observedProfile.value.intentSignalProjection || {})
const constraintDecisionModel = computed(() => props.workflowRead?.constraintDecisionModel || null)
const constraintValueEligibility = computed(() => props.workflowRead?.constraintValueEligibility || null)
const observedSuggestions = computed(() => Array.isArray(observedProfile.value.suggestions)
  ? observedProfile.value.suggestions
  : [])
const observedEvidence = computed(() => Array.isArray(intentSignalProjection.value.observedEvidence)
  ? intentSignalProjection.value.observedEvidence
  : [])
const intentSignalOptions = computed(() => Array.isArray(intentSignalProjection.value.options)
  ? intentSignalProjection.value.options
  : [])
const customEntryInput = computed(() => intentSignalProjection.value.customEntryInput || null)
const sections = computed(() => Array.isArray(workflow.value?.sections)
  ? workflow.value.sections
  : [])
const emptyStates = computed(() => Array.isArray(props.workflowRead?.emptyStateProjection?.states)
  ? props.workflowRead.emptyStateProjection.states
  : [])
const libraryName = computed(() => props.workflowRead?.library?.name || 'this library')
const destinationTitle = computed(() => (
  props.selectionEnabled ? 'Define this destination' : workflow.value?.title || 'Destination setup'
))
const destinationSummary = computed(() => (
  props.selectionEnabled
    ? 'Classifarr starts with what is already in this library. Accept only the observed values that should define future matches.'
    : workflow.value?.summary || 'Use the connected library to understand this destination before adding policy details.'
))
const nativeEvidenceRecovery = computed(() => buildPolicyNativeEvidenceRecovery({
  selectionEnabled: props.selectionEnabled,
  workflowRead: props.workflowRead,
  loading: props.loading,
  error: props.error,
  refreshResult: props.refreshResult,
}))
const activeEmptyStateActionMessage = computed(() => {
  const activeAction = emptyStates.value.find(
    emptyState => emptyState?.nextAction?.actionId === props.activeEmptyStateActionId
  )?.nextAction

  return props.activeEmptyStateActionMessage ||
    activeAction?.busyMessage ||
    activeAction?.busyLabel ||
    ''
})
const workflowStatus = computed(() => buildPolicyBuilderWorkflowStatus({
  loading: props.loading,
  error: props.error,
  refreshing: props.refreshing,
  activeEmptyStateActionId: props.activeEmptyStateActionId,
  activeEmptyStateActionMessage: activeEmptyStateActionMessage.value,
  nativeEvidenceRecovery: nativeEvidenceRecovery.value,
  refreshResult: props.refreshResult,
}))
const emptyStateActionStatusId = computed(() => (
  props.activeEmptyStateActionId ? workflowStatus.value?.id || '' : ''
))

</script>
