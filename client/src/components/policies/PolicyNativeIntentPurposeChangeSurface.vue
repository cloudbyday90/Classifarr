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
    class="rounded-lg border border-indigo-800/70 bg-indigo-950/20 p-4 text-indigo-50"
    aria-labelledby="policy-native-purpose-change-title"
  >
    <h4
      id="policy-native-purpose-change-title"
      class="font-semibold"
    >
      Declared purpose maintenance
    </h4>
    <p class="mt-1 text-sm text-indigo-100">
      Change only the stored native purpose. This does not edit compatibility policy data, select routing, invoke AI, or change learning.
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

      <div
        v-if="!editing"
        class="mt-4 flex flex-wrap items-center gap-3"
      >
        <button
          type="button"
          class="rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          @click="startEditing"
        >
          Change declared purpose
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
          Review every rule below. Applying replaces this revision's purpose collection and creates the next native revision.
        </p>

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

        <div class="flex flex-wrap gap-3">
          <button
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
            {{ applying ? 'Applying purpose change...' : 'Apply purpose change' }}
          </button>
          <button
            type="button"
            class="rounded border border-gray-500 px-3 py-2 text-sm text-gray-100 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="applying"
            @click="cancelEditing"
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
import { computed } from 'vue'
import { usePolicyNativeIntentPurposeChange } from '@/composables/usePolicyNativeIntentPurposeChange'
import {
  createNativePurposeRule,
  getNativePurposeOperatorValueKey,
  NATIVE_PURPOSE_CONSTRAINT_MODES,
  NATIVE_PURPOSE_OPERATORS,
  NATIVE_PURPOSE_SEMANTICS,
  NATIVE_PURPOSE_SIGNAL_TYPES,
  parseNativePurposeTerms,
} from '@/utils/policyNativeIntentPurposeChange'

defineOptions({
  name: 'PolicyNativeIntentPurposeChangeSurface',
})

const props = defineProps({
  policyId: {
    type: Number,
    required: true,
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
  read,
  currentCommand,
  currentRevision,
  available,
  clearPreflight,
  startEditing,
  cancelEditing,
  runPreflight,
  apply,
  watchPurposeChange,
} = usePolicyNativeIntentPurposeChange()

const normalizedPolicyId = computed(() => Number(props.policyId))
watchPurposeChange(normalizedPolicyId)

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

async function reviewCoverage() {
  await runPreflight(normalizedPolicyId.value)
}

async function applyPurposeChange() {
  const applied = await apply(normalizedPolicyId.value)
  if (applied) emit('authority-refreshed', read.value)
}
</script>
