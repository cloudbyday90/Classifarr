<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    v-if="!accessDenied"
    id="policy-native-purpose-change"
    tabindex="-1"
    class="rounded-lg border border-indigo-800/70 bg-indigo-950/20 p-4 text-indigo-50"
    aria-labelledby="policy-native-purpose-change-title"
  >
    <h4
      id="policy-native-purpose-change-title"
      class="font-semibold"
    >
      {{ hasPurposeBootstrap ? 'Set library purpose' : 'Declared purpose maintenance' }}
    </h4>
    <p class="mt-1 text-sm text-indigo-100">
      This saved purpose tells Classifarr what belongs here. It does not edit compatibility policy data, move media, or change learning by itself.
    </p>

    <p
      v-if="loading"
      class="mt-3 text-sm text-indigo-100"
      role="status"
      aria-live="polite"
    >
      Loading the current native purpose and revision...
    </p>

    <p
      v-else-if="readError"
      class="mt-3 rounded border border-red-500/50 bg-red-950/30 p-3 text-sm text-red-100"
      role="alert"
    >
      {{ readError }}
    </p>

    <template v-else-if="available">
      <p class="mt-3 text-sm text-indigo-100">
        Current native revision: <span class="font-semibold text-indigo-50">{{ currentRevision }}</span>
      </p>
      <section
        v-if="provenancePresentation"
        id="policy-native-purpose-provenance"
        class="mt-3 rounded border border-indigo-700/70 bg-gray-950/30 p-3 text-sm"
        aria-labelledby="policy-native-purpose-provenance-title"
      >
        <h5
          id="policy-native-purpose-provenance-title"
          class="font-medium text-indigo-50"
        >
          {{ provenancePresentation.title }}
        </h5>
        <p class="mt-1 text-indigo-100">
          {{ provenancePresentation.description }}
        </p>
      </section>
      <p
        v-if="recentReceiptNotice"
        id="policy-native-purpose-change-recent-receipt"
        class="mt-3 rounded border border-green-500/50 bg-green-950/20 p-3 text-sm text-green-100"
        role="status"
        aria-live="polite"
      >
        {{ recentReceiptNotice }}
      </p>

      <div
        v-if="!editing"
        class="mt-4 flex flex-wrap items-center gap-3"
      >
        <button
          type="button"
          class="rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          @click="startPurposeEditing"
        >
          {{ provenancePresentation?.startLabel || 'Review purpose' }}
        </button>
        <p
          v-if="feedback"
          class="text-sm text-green-200"
          role="status"
          aria-live="polite"
        >
          {{ feedback }}
        </p>
      </div>

      <form
        v-else
        class="mt-4 space-y-4"
        @submit.prevent="applyPurposeChange"
      >
        <p class="text-sm text-indigo-100">
          {{ hasPurposeBootstrap
            ? 'Select only the signals that define this library. Current contents are suggestions, not the definition of the collection.'
            : (provenancePresentation?.editingDescription || 'Review every rule below before applying a native revision.') }}
        </p>

        <PolicyNativeIntentPurposeBootstrap
          v-if="showPurposeBootstrap"
          :suggestion-command="read?.changeCommand"
          :model-value="draftRules"
          :library-name="libraryName"
          :busy="preflightLoading || applying"
          @update:model-value="replaceBootstrapDraft"
          @show-advanced="showAdvancedPurposeControls = true"
        />

        <details
          v-if="showPurposeBootstrap"
          class="rounded border border-gray-700 bg-gray-950/20 p-3 text-sm text-indigo-100"
        >
          <summary class="cursor-pointer font-medium text-indigo-50">
            Why the observed terms need review
          </summary>
          <p class="mt-2">
            Current contents can reflect earlier placements or broad library history. Only the terms you keep in this revision become the declared purpose used by policy evaluation.
          </p>
        </details>

        <section
          v-if="confirmedOutcomeSuggestion"
          id="policy-native-purpose-confirmed-outcome-suggestion"
          class="rounded border border-indigo-700/70 bg-indigo-950/30 p-3 text-sm"
          aria-labelledby="policy-native-purpose-confirmed-outcome-suggestion-title"
        >
          <h5
            id="policy-native-purpose-confirmed-outcome-suggestion-title"
            class="font-medium text-indigo-50"
          >
            Learned suggestion
          </h5>
          <p class="mt-1 text-indigo-100">
            {{ confirmedOutcomeSuggestion.suggestion.confirmationCount }} confirmed choice{{ confirmedOutcomeSuggestion.suggestion.confirmationCount === 1 ? '' : 's' }} support additional genre terms. This is a review draft, not a routing decision.
          </p>
          <button
            type="button"
            class="mt-3 rounded border border-indigo-400 px-3 py-1.5 text-sm font-medium text-indigo-100 hover:bg-indigo-900/40 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="applying"
            @click="applyConfirmedOutcomeSuggestion"
          >
            Add learned terms to this draft
          </button>
          <p
            v-if="learnedSuggestionStatus"
            class="mt-2 text-indigo-100"
            role="status"
            aria-live="polite"
          >
            {{ learnedSuggestionStatus }}
          </p>
        </section>

        <template v-if="!showPurposeBootstrap || showAdvancedPurposeControls">
          <fieldset
            v-for="(rule, index) in draftRules"
            :key="`native-purpose-rule-${index}`"
            class="rounded border border-indigo-800/70 bg-gray-950/30 p-3"
          >
            <legend class="px-1 text-sm font-medium text-indigo-100">
              Purpose rule {{ index + 1 }}
            </legend>

            <div class="grid gap-3 md:grid-cols-2">
              <label class="grid gap-1 text-sm">
                <span>Signal</span>
                <select
                  v-model="rule.signal_type"
                  class="rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-white"
                  @change="clearPreflight"
                >
                  <option
                    v-for="option in signalTypes"
                    :key="option.id"
                    :value="option.id"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </label>

              <label class="grid gap-1 text-sm">
                <span>Matching rule</span>
                <select
                  :value="rule.operator"
                  class="rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-white"
                  @change="setRuleOperator(index, $event.target.value)"
                >
                  <option
                    v-for="option in operators"
                    :key="option.id"
                    :value="option.id"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </label>

              <label class="grid gap-1 text-sm">
                <span>Purpose terms</span>
                <input
                  :value="formatRuleTerms(rule)"
                  type="text"
                  class="rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-white"
                  :aria-label="`Purpose terms for rule ${index + 1}`"
                  autocomplete="off"
                  @input="setRuleTerms(index, $event.target.value)"
                >
                <span class="text-xs text-indigo-200">Separate terms with commas.</span>
              </label>

              <label class="grid gap-1 text-sm">
                <span>Meaning</span>
                <select
                  v-model="rule.semantics"
                  class="rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-white"
                  @change="clearPreflight"
                >
                  <option
                    v-for="option in semantics"
                    :key="option.id"
                    :value="option.id"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </label>

              <label class="grid gap-1 text-sm">
                <span>Constraint mode</span>
                <select
                  v-model="rule.constraint_mode"
                  class="rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-white"
                  @change="clearPreflight"
                >
                  <option
                    v-for="option in constraintModes"
                    :key="option.id"
                    :value="option.id"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </label>
            </div>

            <button
              type="button"
              class="mt-3 rounded border border-red-500/70 px-3 py-1.5 text-sm text-red-100 hover:bg-red-950/50 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="draftRules.length <= 1 || applying"
              @click="removeRule(index)"
            >
              Remove rule
            </button>
          </fieldset>
        </template>

        <div class="flex flex-wrap gap-3">
          <button
            v-if="!showPurposeBootstrap || showAdvancedPurposeControls"
            type="button"
            class="rounded border border-indigo-400 px-3 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-900/40 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="applying"
            @click="addRule"
          >
            Add purpose rule
          </button>
          <button
            type="button"
            class="rounded border border-yellow-400 px-3 py-2 text-sm font-medium text-yellow-100 hover:bg-yellow-900/30 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!currentCommand || preflightLoading || applying"
            @click="reviewCoverage"
          >
            {{ preflightLoading ? 'Reviewing coverage...' : 'Review coverage' }}
          </button>
          <button
            type="submit"
            class="rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!currentCommand || preflightLoading || applying"
          >
            {{ applying
              ? 'Saving library purpose...'
              : (hasPurposeBootstrap ? 'Save library purpose' : (provenancePresentation?.applyLabel || 'Apply purpose change')) }}
          </button>
          <button
            type="button"
            class="rounded border border-gray-500 px-3 py-2 text-sm text-gray-100 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="applying"
            @click="cancelPurposeEditing"
          >
            Cancel
          </button>
        </div>

        <p
          v-if="preflightError"
          class="rounded border border-red-500/50 bg-red-950/30 p-3 text-sm text-red-100"
          role="alert"
        >
          {{ preflightError }}
        </p>

        <article
          v-if="preflight"
          class="rounded border border-yellow-500/60 bg-yellow-950/20 p-3 text-sm"
          aria-labelledby="native-purpose-change-preflight-title"
        >
          <h5
            id="native-purpose-change-preflight-title"
            class="font-medium text-yellow-100"
          >
            {{ preflight.guidance?.title || 'Coverage review' }}
          </h5>
          <p class="mt-1 text-yellow-50">
            {{ preflight.guidance?.description || 'Coverage is advisory and does not authorize this change.' }}
          </p>
          <p class="mt-2 text-yellow-100">
            {{ preflight.coverage?.overlappingDestinationCount || 0 }} overlapping destination(s) found across {{ preflight.coverage?.requiredTermCount || 0 }} required purpose term(s).
          </p>
        </article>

        <p
          v-if="applyError"
          class="rounded border border-red-500/50 bg-red-950/30 p-3 text-sm text-red-100"
          role="alert"
        >
          {{ applyError }}
        </p>
      </form>
    </template>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import PolicyNativeIntentPurposeBootstrap from '@/components/policies/PolicyNativeIntentPurposeBootstrap.vue'
import { usePolicyNativeIntentPurposeChange } from '@/composables/usePolicyNativeIntentPurposeChange'
import {
  usePolicyNativeIntentConfirmedOutcomePurposeSuggestion,
} from '@/composables/usePolicyNativeIntentConfirmedOutcomePurposeSuggestion'
import {
  cloneNativeIntentPurposeChangeRules,
  createNativePurposeRule,
  getNativePurposeOperatorValueKey,
  NATIVE_PURPOSE_CONSTRAINT_MODES,
  NATIVE_PURPOSE_OPERATORS,
  NATIVE_PURPOSE_SEMANTICS,
  NATIVE_PURPOSE_SIGNAL_TYPES,
  normalizeNativePurposeRules,
  parseNativePurposeTerms,
} from '@/utils/policyNativeIntentPurposeChange'
import {
  isNativePurposeBootstrapEligible,
} from '@/utils/policyNativeIntentPurposeBootstrap'
import {
  getNativeIntentPurposeProvenancePresentation,
} from '@/utils/policyNativeIntentPurposeProvenance'

defineOptions({
  name: 'PolicyNativeIntentPurposeChangeSurface',
})

const props = defineProps({
  policyId: {
    type: Number,
    required: true,
  },
  libraryName: {
    type: String,
    default: '',
  },
})

const emit = defineEmits({
  'authority-refreshed': () => true,
})

const signalTypes = NATIVE_PURPOSE_SIGNAL_TYPES
const operators = NATIVE_PURPOSE_OPERATORS
const semantics = NATIVE_PURPOSE_SEMANTICS
const constraintModes = NATIVE_PURPOSE_CONSTRAINT_MODES

const {
  draftRules,
  loading,
  accessDenied,
  readError,
  editing,
  preflight,
  preflightLoading,
  preflightError,
  applying,
  applyError,
  feedback,
  recentReceiptNotice,
  read,
  currentCommand,
  currentRevision,
  available,
  purposeProvenance,
  clearPreflight,
  startEditing,
  cancelEditing,
  runPreflight,
  apply,
  watchPurposeChange,
} = usePolicyNativeIntentPurposeChange()

const normalizedPolicyId = computed(() => Number(props.policyId))
const provenancePresentation = computed(() =>
  getNativeIntentPurposeProvenancePresentation(purposeProvenance.value))
const showAdvancedPurposeControls = ref(false)
const hasPurposeBootstrap = computed(() => (
  purposeProvenance.value?.id === 'profile_derived' &&
  isNativePurposeBootstrapEligible(read.value?.changeCommand)
))
const showPurposeBootstrap = computed(() => (
  hasPurposeBootstrap.value && !showAdvancedPurposeControls.value
))
watchPurposeChange(normalizedPolicyId)

watch(normalizedPolicyId, () => {
  showAdvancedPurposeControls.value = false
})

const {
  suggestion: confirmedOutcomeSuggestion,
  clear: clearConfirmedOutcomeSuggestion,
  load: loadConfirmedOutcomeSuggestion,
} = usePolicyNativeIntentConfirmedOutcomePurposeSuggestion()
const learnedSuggestionStatus = ref('')

watch(
  [normalizedPolicyId, available],
  ([policyId, purposeChangeAvailable]) => {
    learnedSuggestionStatus.value = ''
    if (!purposeChangeAvailable) {
      clearConfirmedOutcomeSuggestion()
      return
    }
    void loadConfirmedOutcomeSuggestion(policyId)
  },
  { immediate: true },
)

function getRuleTerms(rule) {
  const valueKey = getNativePurposeOperatorValueKey(rule?.operator)
  const values = rule?.values && typeof rule.values === 'object' ? rule.values : {}
  return valueKey ? parseNativePurposeTerms(values[valueKey]) : []
}

function formatRuleTerms(rule) {
  return getRuleTerms(rule).join(', ')
}

function setRuleTerms(index, value) {
  const rule = draftRules.value[index]
  const valueKey = getNativePurposeOperatorValueKey(rule?.operator)
  if (!rule || !valueKey) return

  rule.values = { [valueKey]: parseNativePurposeTerms(value) }
}

function setRuleOperator(index, operator) {
  const rule = draftRules.value[index]
  const valueKey = getNativePurposeOperatorValueKey(operator)
  if (!rule || !valueKey) return

  const terms = getRuleTerms(rule)
  rule.operator = operator
  rule.values = { [valueKey]: terms }
}

function addRule() {
  if (applying.value) return
  draftRules.value.push(createNativePurposeRule())
}

function removeRule(index) {
  if (applying.value || draftRules.value.length <= 1) return
  draftRules.value.splice(index, 1)
}

function startPurposeEditing() {
  showAdvancedPurposeControls.value = false
  startEditing()
}

function cancelPurposeEditing() {
  showAdvancedPurposeControls.value = false
  cancelEditing()
}

function replaceBootstrapDraft(value) {
  if (!Array.isArray(value)) return
  if (value.length === 0) {
    draftRules.value = []
    return
  }

  const normalizedRules = normalizeNativePurposeRules(value)
  if (!normalizedRules) return
  draftRules.value = normalizedRules
}

function applyConfirmedOutcomeSuggestion() {
  if (applying.value) return

  const suggestedRules = cloneNativeIntentPurposeChangeRules(
    confirmedOutcomeSuggestion.value?.suggestion?.changeCommand,
  )
  if (!suggestedRules) return

  const existingRuleKeys = new Set(draftRules.value.map(rule => JSON.stringify(rule)))
  const rulesToAdd = suggestedRules.filter(rule => !existingRuleKeys.has(JSON.stringify(rule)))
  if (rulesToAdd.length === 0) {
    learnedSuggestionStatus.value = 'The suggested purpose terms are already in this review draft.'
    return
  }

  draftRules.value.push(...rulesToAdd)
  learnedSuggestionStatus.value = 'Suggested terms added to this review draft. Review coverage before applying the purpose change.'
}

async function reviewCoverage() {
  await runPreflight(normalizedPolicyId.value)
}

async function applyPurposeChange() {
  const applied = await apply(normalizedPolicyId.value)
  if (applied) {
    await loadConfirmedOutcomeSuggestion(normalizedPolicyId.value)
    emit('authority-refreshed', read.value)
  }
}
</script>
