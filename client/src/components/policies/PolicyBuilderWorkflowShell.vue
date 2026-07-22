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

    <p
      v-if="loading"
      class="rounded border border-blue-800/70 bg-blue-950/30 px-3 py-2 text-sm text-blue-100"
      role="status"
      aria-live="polite"
    >
      Loading the current library workflow.
    </p>

    <template v-else-if="error">
      <p
        class="rounded border border-amber-700/70 bg-amber-950/30 px-3 py-2 text-sm text-amber-100"
        role="alert"
      >
        {{ error }}
      </p>
      <PolicyNativeEvidenceRecovery
        v-if="selectionEnabled && nativeEvidenceRecovery.requiresAction"
        :recovery="nativeEvidenceRecovery"
        :refreshing="refreshing"
        @refresh-profile="emit('refresh-profile')"
        @reload-workflow="emit('reload-workflow')"
      />
    </template>

    <template v-else-if="workflowRead">
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
        :accepted-candidates="acceptedCandidates"
        :selectable-suggestions="selectableSuggestions"
        :library-name="libraryName"
        :empty-states="emptyStates"
        :empty-state-action-busy="emptyStateActionBusy"
        @draft-command-plan="emit('draft-command-plan', $event)"
        @refresh-profile="emit('refresh-profile')"
        @reload-workflow="emit('reload-workflow')"
        @empty-state-action="emit('empty-state-action', $event)"
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
import ReadinessNextActionCard from './ReadinessNextActionCard.vue'
import { buildPolicyNativeEvidenceRecovery } from '@/utils/policyNativeEvidenceRecovery'

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
  acceptedCandidates: {
    type: Array,
    default: () => [],
  },
  selectionEnabled: {
    type: Boolean,
    default: false,
  },
  emptyStateActionBusy: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits({
  'draft-command-plan': plan => Boolean(plan?.commands?.length),
  'refresh-profile': () => true,
  'reload-workflow': () => true,
  'empty-state-action': emptyState => Boolean(emptyState?.stateId && emptyState?.nextAction?.actionId),
})

const workflow = computed(() => props.workflowRead?.workflow || null)
const observedProfile = computed(() => props.workflowRead?.observedProfile || {})
const observedSuggestions = computed(() => Array.isArray(observedProfile.value.suggestions)
  ? observedProfile.value.suggestions
  : [])
const selectableSuggestions = computed(() => Array.isArray(observedProfile.value.selectableSuggestions)
  ? observedProfile.value.selectableSuggestions
  : [])
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

</script>
