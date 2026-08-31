<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->

<template>
  <section
    class="bg-gray-800 rounded-lg border border-gray-700 p-5 space-y-4"
    aria-labelledby="policy-change-decision-record-heading"
  >
    <div>
      <h3
        id="policy-change-decision-record-heading"
        class="text-lg font-medium"
      >
        Policy-change reviewed decision
      </h3>
      <p class="mt-1 text-sm text-gray-400">
        A bounded conclusion for the completed aggregate follow-up. It never applies or edits a policy, and never changes AI, RAG, learning, retry, or routing.
      </p>
    </div>

    <div
      class="rounded-md border border-gray-700 bg-gray-900/40 p-4"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <template v-if="presentation">
        <p
          class="font-medium"
          :class="presentation.statusClass"
        >
          {{ presentation.heading }}
        </p>
        <p class="mt-1 text-sm text-gray-300">
          {{ presentation.message }}
        </p>
        <p
          v-if="actionStatus"
          class="mt-2 text-sm text-green-400"
        >
          {{ actionStatus }}
        </p>
      </template>
      <p
        v-else-if="loading"
        class="text-sm text-gray-400"
      >
        Checking the reviewed-decision status…
      </p>
      <p
        v-else
        class="text-sm text-gray-400"
      >
        The reviewed-decision status will load automatically when the aggregate follow-up is ready.
      </p>
    </div>

    <p
      v-if="error"
      class="rounded-md bg-red-900/30 p-3 text-sm text-red-300"
      role="alert"
    >
      {{ error }}
    </p>

    <form
      v-if="decisionRecord?.reviewAvailable"
      class="space-y-5"
      @submit.prevent="saveDecision"
    >
      <fieldset
        class="space-y-3"
        :disabled="saving"
      >
        <legend class="text-sm font-medium text-gray-100">
          Reviewed conclusion
        </legend>
        <p class="text-sm text-gray-400">
          Choose the next manual step. This selection is a record only; it is not a command.
        </p>
        <label
          v-for="option in POLICY_CHANGE_DECISION_OPTIONS"
          :key="option.id"
          class="flex items-start gap-3 rounded-md border border-gray-700 p-3 text-sm text-gray-200"
        >
          <input
            v-model="selectedDecisionId"
            class="mt-0.5 h-4 w-4 border-gray-500 bg-gray-900 text-blue-600 focus:ring-2 focus:ring-blue-500"
            type="radio"
            name="policy-change-reviewed-decision"
            :value="option.id"
            @change="reviewAcknowledged = false"
          >
          <span>{{ option.label }}</span>
        </label>
      </fieldset>

      <fieldset
        class="space-y-3"
        :disabled="saving"
      >
        <legend class="text-sm font-medium text-gray-100">
          Aggregate rationale
        </legend>
        <p class="text-sm text-gray-400">
          Use the completed aggregate comparison as the basis. Contextual review remains separate from this card.
        </p>
        <label
          v-for="option in POLICY_CHANGE_DECISION_RATIONALE_OPTIONS"
          :key="option.id"
          class="flex items-start gap-3 rounded-md border border-gray-700 p-3 text-sm text-gray-200"
        >
          <input
            v-model="selectedRationaleId"
            class="mt-0.5 h-4 w-4 border-gray-500 bg-gray-900 text-blue-600 focus:ring-2 focus:ring-blue-500"
            type="radio"
            name="policy-change-reviewed-rationale"
            :value="option.id"
            @change="reviewAcknowledged = false"
          >
          <span>{{ option.label }}</span>
        </label>
      </fieldset>

      <label class="flex items-start gap-3 rounded-md border border-gray-700 p-3 text-sm text-gray-200">
        <input
          v-model="reviewAcknowledged"
          class="mt-0.5 h-4 w-4 rounded border-gray-500 bg-gray-900 text-blue-600 focus:ring-2 focus:ring-blue-500"
          type="checkbox"
          :disabled="saving"
        >
        <span>I reviewed the completed aggregate comparison and understand that this only records a manual conclusion.</span>
      </label>

      <button
        type="submit"
        :disabled="!canSave"
        class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-600"
      >
        {{ saving ? 'Saving reviewed decision…' : decisionRecord.decision ? 'Revise reviewed decision' : 'Record reviewed decision' }}
      </button>
    </form>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import api from '@/api'
import {
  getPolicyCandidateCorrectionPolicyChangeDecisionRecordPresentation,
  normalizePolicyCandidateCorrectionPolicyChangeDecisionRecord,
  POLICY_CHANGE_DECISION_OPTIONS,
  POLICY_CHANGE_DECISION_RATIONALE_OPTIONS,
} from '@/utils/policyCandidateCorrectionPolicyChangeDecisionRecordPresentation'

const props = defineProps({
  outcomeObservation: {
    type: Object,
    default: null,
  },
})

const decisionRecord = ref(null)
const loading = ref(false)
const saving = ref(false)
const error = ref(null)
const actionStatus = ref(null)
const selectedDecisionId = ref('')
const selectedRationaleId = ref('')
const reviewAcknowledged = ref(false)

const outcomeIsReady = computed(() => (
  props.outcomeObservation?.statusId === 'outcome_available' &&
  Boolean(props.outcomeObservation?.outcome) &&
  Boolean(props.outcomeObservation?.observation?.hypothesisId)
))
const presentation = computed(() => (
  getPolicyCandidateCorrectionPolicyChangeDecisionRecordPresentation(decisionRecord.value?.statusId)
))
const canSave = computed(() => (
  !saving.value && decisionRecord.value?.reviewAvailable === true &&
  Boolean(selectedDecisionId.value) && Boolean(selectedRationaleId.value) && reviewAcknowledged.value
))

function applyDecisionRecord(value) {
  const normalized = normalizePolicyCandidateCorrectionPolicyChangeDecisionRecord(value)
  if (!normalized) throw new Error('Policy-change reviewed decision returned an unexpected response.')
  if (outcomeIsReady.value && normalized.observation &&
      normalized.observation.hypothesisId !== props.outcomeObservation.observation.hypothesisId) {
    throw new Error('Policy-change reviewed decision did not match the active aggregate follow-up.')
  }
  decisionRecord.value = normalized
  if (normalized.decision) {
    selectedDecisionId.value = normalized.decision.decisionId
    selectedRationaleId.value = normalized.decision.rationaleId
  } else {
    selectedDecisionId.value = ''
    selectedRationaleId.value = ''
  }
}

async function loadDecisionRecord() {
  if (!outcomeIsReady.value) {
    decisionRecord.value = null
    error.value = null
    actionStatus.value = null
    reviewAcknowledged.value = false
    return
  }

  loading.value = true
  error.value = null
  try {
    applyDecisionRecord(await api.getPolicyCandidateCorrectionPolicyChangeDecisionRecord())
  } catch (loadError) {
    console.error('Failed to load policy-change reviewed decision:', loadError)
    decisionRecord.value = null
    error.value = 'Unable to load the reviewed-decision status. No policy, AI, RAG, or routing change was made.'
  } finally {
    loading.value = false
  }
}

async function saveDecision() {
  if (!canSave.value) return

  saving.value = true
  error.value = null
  actionStatus.value = null
  try {
    const payload = {
      decisionId: selectedDecisionId.value,
      rationaleId: selectedRationaleId.value,
    }
    const response = decisionRecord.value.decision
      ? await api.revisePolicyCandidateCorrectionPolicyChangeDecisionRecord({
        ...payload,
        expectedRevision: decisionRecord.value.decision.revision,
      })
      : await api.createPolicyCandidateCorrectionPolicyChangeDecisionRecord(payload)
    applyDecisionRecord(response.data)
    reviewAcknowledged.value = false
    actionStatus.value = 'Reviewed decision saved. It did not change policy, AI, RAG, learning, retry, or routing.'
  } catch (saveError) {
    console.error('Failed to save policy-change reviewed decision:', saveError)
    error.value = saveError.response?.data?.error ||
      'Unable to save the reviewed decision. No policy, AI, RAG, or routing change was made.'
    if (saveError.response?.status === 409) {
      await loadDecisionRecord()
      error.value = 'Another administrator may have updated this reviewed decision. The current status was reloaded; review it before trying again.'
    }
  } finally {
    saving.value = false
  }
}

watch(
  () => [props.outcomeObservation?.statusId, props.outcomeObservation?.observation?.hypothesisId],
  () => {
    loadDecisionRecord()
  },
  { immediate: true },
)
</script>
