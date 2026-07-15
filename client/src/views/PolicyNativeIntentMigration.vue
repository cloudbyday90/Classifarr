<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm font-medium text-primary">
          Administrator maintenance
        </p>
        <h1 class="mt-1 text-2xl font-bold">
          Native intent conversion
        </h1>
        <p class="mt-2 max-w-3xl text-sm text-gray-400">
          Move eligible existing policies from compatibility projection to native
          intent storage. This is separate from policy editing and does not
          configure routing or change automation readiness.
        </p>
      </div>
      <div class="flex gap-3">
        <RouterLink
          to="/policies"
          class="rounded border border-gray-600 px-4 py-2 text-sm font-medium text-gray-200 hover:border-gray-400"
        >
          Back to policies
        </RouterLink>
        <button
          type="button"
          class="rounded border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="isLoading || isApplying"
          @click="loadPreview"
        >
          {{ isLoading ? 'Refreshing...' : 'Refresh preview' }}
        </button>
      </div>
    </div>

    <div
      v-if="errorMessage"
      class="rounded border border-red-500/50 bg-red-950/30 p-4 text-sm text-red-100"
      role="alert"
    >
      {{ errorMessage }}
    </div>

    <div
      v-if="successMessage"
      class="rounded border border-green-500/50 bg-green-950/30 p-4 text-sm text-green-100"
      role="status"
    >
      {{ successMessage }}
    </div>

    <section
      v-if="runtimeObservation"
      class="rounded-lg border p-5"
      :class="runtimeObservation.statusId === 'verified'
        ? 'border-green-500/50 bg-green-950/20'
        : 'border-yellow-500/50 bg-yellow-950/20'"
      aria-labelledby="runtime-observation-heading"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="runtime-observation-heading"
            class="text-lg font-semibold"
          >
            Post-conversion runtime verification
          </h2>
          <p class="mt-1 max-w-3xl text-sm text-gray-300">
            Classifarr re-read the selected policies from native storage after
            conversion. This proof does not change routing, automation, or
            compatibility-deletion readiness.
          </p>
        </div>
        <span
          class="rounded-full border px-2 py-1 text-xs font-medium"
          :class="runtimeObservation.statusId === 'verified'
            ? 'border-green-500/60 text-green-200'
            : 'border-yellow-500/60 text-yellow-200'"
        >
          {{ formatRuntimeObservationStatus(runtimeObservation.statusId) }}
        </span>
      </div>
      <dl class="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <dt class="text-xs uppercase tracking-wide text-gray-400">
            Policies checked
          </dt>
          <dd class="mt-1 font-semibold text-white">
            {{ runtimeObservation.summary?.observedPolicyCount ?? 0 }}
          </dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-gray-400">
            Native reads verified
          </dt>
          <dd class="mt-1 font-semibold text-white">
            {{ runtimeObservation.summary?.nativeReadVerifiedCount ?? 0 }}
          </dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-gray-400">
            Active rollback snapshots
          </dt>
          <dd class="mt-1 font-semibold text-white">
            {{ runtimeObservation.summary?.rollbackAvailableCount ?? 0 }}
          </dd>
        </div>
      </dl>
      <p
        v-if="runtimeObservation.statusId !== 'verified'"
        class="mt-4 text-sm text-yellow-100"
      >
        Conversion completed, but this read-only verification needs attention.
        Native storage was not reverted automatically.
      </p>
    </section>

    <section
      class="rounded-lg border border-primary/40 bg-primary/5 p-5"
      aria-labelledby="conversion-boundary-heading"
    >
      <h2
        id="conversion-boundary-heading"
        class="text-lg font-semibold"
      >
        What this action does
      </h2>
      <p class="mt-2 text-sm text-gray-300">
        Conversion writes native intent, a rollback snapshot, and an audit event
        for each selected policy. The server checks the live policy state again
        at apply time. Routing and profile refresh are evaluated separately.
      </p>
    </section>

    <section
      class="grid gap-4 sm:grid-cols-3"
      aria-label="Conversion preview summary"
    >
      <div class="rounded-lg border border-gray-700 bg-background-light p-4">
        <p class="text-sm text-gray-400">
          Policies reviewed
        </p>
        <p class="mt-1 text-2xl font-semibold">
          {{ candidateReport.summary?.totalPolicyCount ?? 0 }}
        </p>
      </div>
      <div class="rounded-lg border border-green-600/40 bg-green-950/20 p-4">
        <p class="text-sm text-green-200">
          Ready to convert
        </p>
        <p class="mt-1 text-2xl font-semibold text-green-100">
          {{ candidateReport.summary?.convertibleCount ?? 0 }}
        </p>
      </div>
      <div class="rounded-lg border border-yellow-600/40 bg-yellow-950/20 p-4">
        <p class="text-sm text-yellow-200">
          Need review
        </p>
        <p class="mt-1 text-2xl font-semibold text-yellow-100">
          {{ candidateReport.summary?.reviewRequiredCount ?? 0 }}
        </p>
      </div>
    </section>

    <section
      class="overflow-hidden rounded-lg border border-gray-700 bg-background-light"
      aria-labelledby="conversion-candidates-heading"
    >
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-700 p-5">
        <div>
          <h2
            id="conversion-candidates-heading"
            class="text-lg font-semibold"
          >
            Current conversion candidates
          </h2>
          <p class="mt-1 text-sm text-gray-400">
            The server marks only ready policies as selectable. Select up to
            {{ MAX_SELECTED_POLICY_COUNT }} policies per conversion action.
          </p>
        </div>
        <button
          v-if="selectedCount > 0"
          type="button"
          class="text-sm text-gray-300 underline hover:text-white"
          :disabled="isApplying"
          @click="clearSelection"
        >
          Clear selection
        </button>
      </div>

      <div
        v-if="isLoading && !preview"
        class="p-8 text-center text-sm text-gray-400"
      >
        Loading current conversion candidates...
      </div>

      <div
        v-else-if="candidates.length === 0"
        class="p-8 text-center text-sm text-gray-400"
      >
        No policies are currently available in the bounded conversion report.
      </div>

      <div
        v-else
        class="overflow-x-auto"
      >
        <table class="min-w-full text-left text-sm">
          <caption class="sr-only">
            Native intent conversion candidates and readiness
          </caption>
          <thead class="bg-background text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th
                scope="col"
                class="w-16 px-4 py-3"
              >
                Select
              </th>
              <th
                scope="col"
                class="px-4 py-3"
              >
                Policy
              </th>
              <th
                scope="col"
                class="px-4 py-3"
              >
                Native conversion
              </th>
              <th
                scope="col"
                class="px-4 py-3"
              >
                Automation
              </th>
              <th
                scope="col"
                class="px-4 py-3"
              >
                Details
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800">
            <tr
              v-for="candidate in candidates"
              :key="candidate.policyId"
            >
              <td class="px-4 py-4 align-top">
                <input
                  :id="`native-intent-policy-${candidate.policyId}`"
                  type="checkbox"
                  :checked="isSelected(candidate.policyId)"
                  :disabled="candidate.canConvert !== true || (!isSelected(candidate.policyId) && selectedCount >= MAX_SELECTED_POLICY_COUNT) || isApplying"
                  :aria-label="`Select ${candidate.policyName} for native intent conversion`"
                  class="h-4 w-4 rounded border-gray-500 bg-background text-primary focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                  @change="selectPolicy(candidate.policyId, $event.target.checked)"
                >
              </td>
              <th
                scope="row"
                class="px-4 py-4 align-top font-medium text-white"
              >
                <div>{{ candidate.policyName }}</div>
                <div class="mt-1 text-xs font-normal text-gray-400">
                  {{ candidate.libraryName || 'Library unavailable' }}
                </div>
              </th>
              <td class="px-4 py-4 align-top">
                <span
                  class="inline-flex rounded-full border px-2 py-1 text-xs font-medium"
                  :class="candidate.canConvert ? 'border-green-500/60 bg-green-950/30 text-green-200' : 'border-yellow-500/60 bg-yellow-950/30 text-yellow-200'"
                >
                  {{ candidate.canConvert ? 'Ready to convert' : 'Needs review' }}
                </span>
              </td>
              <td class="px-4 py-4 align-top text-gray-300">
                {{ formatAutomationReadiness(candidate.automationReadiness?.statusId) }}
              </td>
              <td class="max-w-md px-4 py-4 align-top text-xs text-gray-400">
                <ul class="space-y-1">
                  <li
                    v-for="reason in visibleReasons(candidate)"
                    :key="reason.reasonId"
                  >
                    {{ reason.message }}
                  </li>
                </ul>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="sticky bottom-0 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-primary/40 bg-background p-4 shadow-lg">
      <p class="text-sm text-gray-300">
        <span class="font-semibold text-white">{{ selectedCount }}</span>
        of {{ MAX_SELECTED_POLICY_COUNT }} selected
      </p>
      <button
        type="button"
        class="rounded bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!canOpenConfirmation"
        @click="showConfirmation = true"
      >
        Review conversion
      </button>
    </div>

    <PolicyNativeIntentConversionConfirmDialog
      v-model="showConfirmation"
      :selected-candidates="selectedCandidates"
      :confirmation-value="POLICY_NATIVE_INTENT_CONVERSION_CONFIRMATION"
      :is-applying="isApplying"
      @confirm="handleConfirmation"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import PolicyNativeIntentConversionConfirmDialog from '@/components/policies/PolicyNativeIntentConversionConfirmDialog.vue'
import { usePolicyNativeIntentConversionMaintenance } from '@/composables/usePolicyNativeIntentConversionMaintenance'

const showConfirmation = ref(false)
const {
  MAX_SELECTED_POLICY_COUNT,
  POLICY_NATIVE_INTENT_CONVERSION_CONFIRMATION,
  preview,
  candidateReport,
  candidates,
  selectedCandidates,
  selectedCount,
  isLoading,
  isApplying,
  errorMessage,
  successMessage,
  runtimeObservation,
  canOpenConfirmation,
  isSelected,
  selectPolicy,
  clearSelection,
  loadPreview,
  applySelectedPolicies,
} = usePolicyNativeIntentConversionMaintenance()

const AUTOMATION_READINESS_LABELS = {
  ready_for_automation: 'Ready for automation',
  needs_routing_target: 'Routing target needed',
  needs_profile_refresh: 'Profile refresh needed',
  needs_routing_target_and_profile_refresh: 'Routing and profile refresh needed',
}

const RUNTIME_OBSERVATION_STATUS_LABELS = {
  verified: 'Verified',
  blocked: 'Needs attention',
  unavailable: 'Verification unavailable',
}

function formatAutomationReadiness(statusId) {
  return AUTOMATION_READINESS_LABELS[statusId] || 'Readiness unavailable'
}

function formatRuntimeObservationStatus(statusId) {
  return RUNTIME_OBSERVATION_STATUS_LABELS[statusId] || 'Verification unavailable'
}

function visibleReasons(candidate) {
  return Array.isArray(candidate?.reasons)
    ? candidate.reasons.filter(reason => reason?.reasonId !== 'raw_legacy_json_suppressed')
    : []
}

async function handleConfirmation(confirmation) {
  const result = await applySelectedPolicies(confirmation)

  if (result.applied) {
    showConfirmation.value = false
  }
}

onMounted(loadPreview)
</script>
