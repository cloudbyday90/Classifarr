<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <ol
    class="gap-3"
    :class="selectionEnabled ? 'space-y-3' : 'grid lg:grid-cols-2'"
    aria-label="Destination policy questions"
  >
    <li
      v-for="section in sections"
      :key="section.sectionId"
      class="rounded-lg border border-gray-700 bg-background-light p-3"
    >
      <article :aria-labelledby="sectionHeadingId(section.sectionId)">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <h5
            :id="sectionHeadingId(section.sectionId)"
            class="text-sm font-semibold text-white"
          >
            {{ section.heading }}
          </h5>
          <span
            class="rounded-full border px-2 py-0.5 text-[11px] font-medium"
            :class="sectionStatusClass(section.statusId)"
          >
            {{ sectionStatusLabel(section.statusId) }}
          </span>
        </div>
        <p class="mt-2 text-sm text-gray-100">
          {{ section.plainQuestion }}
        </p>
        <p class="mt-1 text-xs text-gray-400">
          {{ section.helperText }}
        </p>

        <PolicyDestinationEmptyStateNotice
          v-for="emptyState in emptyStatesFor(section.sectionId)"
          :key="emptyState.stateId"
          :empty-state="emptyState"
          :busy="emptyStateActionBusy"
          @next-action="emit('empty-state-action', $event)"
        />

        <PolicyNativeEvidenceRecovery
          v-if="showsObservedEvidenceActions(section) && nativeEvidenceRecovery.requiresAction"
          :recovery="nativeEvidenceRecovery"
          :refreshing="refreshing"
          @refresh-profile="emit('refresh-profile')"
          @reload-workflow="emit('reload-workflow')"
        />

        <PolicyObservedSuggestionSelector
          v-if="showsObservedEvidenceActions(section) && nativeEvidenceRecovery.canSelectObservedCandidates"
          :accepted-candidates="acceptedCandidates"
          :candidates="selectableSuggestions"
          :library-name="libraryName"
          @draft-command-plan="emit('draft-command-plan', $event)"
        />

        <p
          v-if="section.readiness?.nextAction?.label"
          class="mt-3 rounded border border-gray-700 bg-background px-2 py-1 text-xs text-gray-300"
        >
          Next: {{ section.readiness.nextAction.label }}
        </p>
        <p
          v-else-if="section.editable && !selectionEnabled"
          class="mt-3 text-xs text-gray-400"
        >
          Policy changes remain explicit and are made in the policy details below.
        </p>
        <p
          v-else-if="selectionEnabled && section.sectionId !== 'what_belongs_here'"
          class="mt-3 text-xs text-gray-400"
        >
          {{ nativeQuestionGuidance(section) }}
        </p>
      </article>
    </li>
  </ol>
</template>

<script setup>
import PolicyDestinationEmptyStateNotice from './PolicyDestinationEmptyStateNotice.vue'
import PolicyNativeEvidenceRecovery from './PolicyNativeEvidenceRecovery.vue'
import PolicyObservedSuggestionSelector from './PolicyObservedSuggestionSelector.vue'

const props = defineProps({
  sections: {
    type: Array,
    default: () => [],
  },
  selectionEnabled: {
    type: Boolean,
    default: false,
  },
  nativeEvidenceRecovery: {
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
  selectableSuggestions: {
    type: Array,
    default: () => [],
  },
  libraryName: {
    type: String,
    default: 'this library',
  },
  emptyStates: {
    type: Array,
    default: () => [],
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

const sectionHeadingId = sectionId => `policy-builder-workflow-${sectionId}-title`

const showsObservedEvidenceActions = section => (
  props.selectionEnabled && section?.sectionId === 'what_belongs_here'
)

const emptyStatesFor = sectionId => props.emptyStates.filter(
  emptyState => emptyState?.sectionId === sectionId
)

const sectionStatusLabel = (statusId) => {
  if (statusId === 'complete') return 'Ready'
  if (statusId === 'optional') return 'Optional'
  return 'Needs attention'
}

const sectionStatusClass = (statusId) => {
  if (statusId === 'complete') {
    return 'border-green-800/70 bg-green-950/30 text-green-200'
  }

  if (statusId === 'optional') {
    return 'border-blue-800/70 bg-blue-950/30 text-blue-200'
  }

  return 'border-amber-700/70 bg-amber-950/30 text-amber-200'
}

const nativeQuestionGuidance = (section) => {
  if (section.sectionId === 'can_this_route') {
    return 'Creation does not route media. Classifarr will only apply approved matches after routing is ready.'
  }

  if (section.statusId === 'optional') {
    return 'No action is needed now. Classifarr will keep this as a later explicit policy decision.'
  }

  return 'This question is shown for context. Its policy controls are introduced only when an explicit decision is needed.'
}
</script>
