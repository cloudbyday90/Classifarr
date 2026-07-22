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
    <header>
      <p class="text-xs font-semibold uppercase tracking-wide text-primary">
        Policy setup
      </p>
      <h4
        id="policy-builder-workflow-title"
        class="mt-1 text-lg font-semibold text-white"
      >
        {{ selectionEnabled ? 'Define this destination' : workflow?.title || 'Destination setup' }}
      </h4>
      <p class="mt-1 max-w-3xl text-sm text-gray-300">
        {{ selectionEnabled
          ? 'Classifarr starts with what is already in this library. Accept only the observed values that should define future matches.'
          : workflow?.summary || 'Use the connected library to understand this destination before adding policy details.' }}
      </p>
    </header>

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
      <section
        class="rounded-lg border border-gray-700 bg-background-light p-3"
        aria-labelledby="policy-builder-observed-profile-title"
      >
        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h5
              id="policy-builder-observed-profile-title"
              class="text-sm font-semibold text-white"
            >
              What Classifarr sees in {{ libraryName }}
            </h5>
            <p class="mt-1 text-xs text-gray-400">
              Current library observations make the next choices easier. They are suggestions, not policy rules, until you explicitly accept them.
            </p>
          </div>
          <span
            class="w-fit rounded-full border px-2 py-1 text-xs font-medium"
            :class="observedProfileClass"
          >
            {{ observedProfileLabel }}
          </span>
        </div>

        <p
          v-if="!observedProfile.available"
          class="mt-3 text-sm text-gray-300"
        >
          A current library profile is not available yet.
        </p>
        <p
          v-else-if="observedSuggestions.length === 0"
          class="mt-3 text-sm text-gray-300"
        >
          {{ selectionEnabled
            ? 'Classifarr has not found reusable library observations yet.'
            : 'Classifarr has not found reusable library observations yet. You can still describe the destination below.' }}
        </p>
        <ul
          v-else-if="!selectionEnabled"
          class="mt-3 flex flex-wrap gap-2"
          aria-label="Observed library suggestions"
        >
          <li
            v-for="suggestion in observedSuggestions"
            :key="suggestion.key"
            class="rounded border border-gray-700 bg-background px-2 py-1 text-xs text-gray-200"
          >
            <span class="font-medium">{{ suggestion.label }}</span>
            <span
              v-if="suggestion.count !== null"
              class="ml-1 text-gray-400"
            >
              {{ suggestion.count }} currently here
            </span>
          </li>
        </ul>
      </section>

      <PolicyBuilderDestinationQuestions
        :sections="sections"
        :selection-enabled="selectionEnabled"
        :native-evidence-recovery="nativeEvidenceRecovery"
        :refreshing="refreshing"
        :accepted-candidates="acceptedCandidates"
        :selectable-suggestions="selectableSuggestions"
        :library-name="libraryName"
        @draft-command-plan="emit('draft-command-plan', $event)"
        @refresh-profile="emit('refresh-profile')"
        @reload-workflow="emit('reload-workflow')"
      />

      <p
        v-if="!selectionEnabled && workflow.readiness?.nextAction?.label"
        class="rounded border px-3 py-2 text-sm"
        :class="workflow.readiness.ready ? 'border-green-800/70 bg-green-950/30 text-green-100' : 'border-amber-700/70 bg-amber-950/30 text-amber-100'"
        role="status"
        aria-live="polite"
      >
        <span class="font-semibold">Automation readiness:</span>
        {{ workflow.readiness.nextAction.label }}
      </p>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import PolicyBuilderDestinationQuestions from './PolicyBuilderDestinationQuestions.vue'
import PolicyNativeEvidenceRecovery from './PolicyNativeEvidenceRecovery.vue'
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
})

const emit = defineEmits({
  'draft-command-plan': plan => Boolean(plan?.commands?.length),
  'refresh-profile': () => true,
  'reload-workflow': () => true,
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
const libraryName = computed(() => props.workflowRead?.library?.name || 'this library')
const nativeEvidenceRecovery = computed(() => buildPolicyNativeEvidenceRecovery({
  selectionEnabled: props.selectionEnabled,
  workflowRead: props.workflowRead,
  loading: props.loading,
  error: props.error,
  refreshResult: props.refreshResult,
}))

const observedProfileLabel = computed(() => {
  if (!observedProfile.value.available) return 'Profile unavailable'
  if (!observedProfile.value.current) return 'Profile needs refresh'

  const count = Number(observedProfile.value.suggestionCount) || 0
  return `${count} observed ${count === 1 ? 'signal' : 'signals'}`
})

const observedProfileClass = computed(() => {
  if (!observedProfile.value.available || !observedProfile.value.current) {
    return 'border-amber-700/70 bg-amber-950/30 text-amber-200'
  }

  return 'border-green-800/70 bg-green-950/30 text-green-200'
})

</script>
