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
          Administrator status
        </p>
        <h1 class="mt-1 text-2xl font-bold">
          Native intent reconciliation
        </h1>
        <p class="mt-2 max-w-3xl text-sm text-gray-400">
          Classifarr automatically reconciles eligible policies into native intent storage.
          This page reports the bounded scheduler state. It never selects or converts policies manually; eligible remediation opens the existing guarded policy editor.
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
          :disabled="isLoading"
          @click="loadReconciliationView"
        >
          {{ isLoading ? 'Refreshing...' : 'Refresh status' }}
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

    <section
      v-if="status"
      class="rounded-lg border p-5"
      :class="statusClass"
      aria-labelledby="reconciliation-status-heading"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="reconciliation-status-heading"
            class="text-lg font-semibold"
          >
            {{ statusLabel }}
          </h2>
          <p class="mt-1 max-w-3xl text-sm text-gray-300">
            {{ statusDescription }}
          </p>
        </div>
        <span
          class="rounded-full border px-2 py-1 text-xs font-medium"
          :class="statusBadgeClass"
        >
          {{ statusLabel }}
        </span>
      </div>
      <dl class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt class="text-xs uppercase tracking-wide text-gray-400">
            Automation
          </dt>
          <dd class="mt-1 font-semibold text-white">
            {{ automationLabel }}
          </dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-gray-400">
            Circuit
          </dt>
          <dd class="mt-1 font-semibold text-white">
            {{ formatId(status.control?.circuitState) }}
          </dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-gray-400">
            Unresolved policies
          </dt>
          <dd class="mt-1 font-semibold text-white">
            {{ status.inventory?.unresolvedCount ?? 0 }}
          </dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-gray-400">
            Next scheduled attempt
          </dt>
          <dd class="mt-1 font-semibold text-white">
            {{ formatTimestamp(status.nextScheduledAttemptAt) }}
          </dd>
        </div>
      </dl>
    </section>

    <section
      v-if="status"
      class="grid gap-4 lg:grid-cols-2"
      aria-label="Native intent reconciliation details"
    >
      <article class="rounded-lg border border-gray-700 bg-background-light p-5">
        <h2 class="text-lg font-semibold">
          Latest scheduled run
        </h2>
        <p class="mt-1 text-sm text-gray-400">
          Scheduler-owned evidence only. No client action is required for eligible policies.
        </p>
        <template v-if="status.latestRun">
          <dl class="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt class="text-xs uppercase tracking-wide text-gray-400">
                Completed
              </dt>
              <dd class="mt-1 text-sm text-white">
                {{ formatTimestamp(status.latestRun.completedAt) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-gray-400">
                Outcome
              </dt>
              <dd class="mt-1 text-sm text-white">
                {{ formatId(status.latestRun.reasonId) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-gray-400">
                Converted
              </dt>
              <dd class="mt-1 text-sm text-white">
                {{ status.latestRun.counts?.convertedCount ?? 0 }}
              </dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-gray-400">
                Deferred or blocked
              </dt>
              <dd class="mt-1 text-sm text-white">
                {{ deferredOrBlockedCount }}
              </dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-gray-400">
                Runtime
              </dt>
              <dd class="mt-1 break-all text-sm text-white">
                {{ formatRuntime(status.latestRun.runtime) }}
              </dd>
            </div>
          </dl>
        </template>
        <p
          v-else
          class="mt-4 text-sm text-gray-400"
        >
          No completed reconciliation run is available yet.
        </p>
      </article>

      <article class="rounded-lg border border-gray-700 bg-background-light p-5">
        <h2 class="text-lg font-semibold">
          What happens next
        </h2>
        <p class="mt-1 text-sm text-gray-400">
          Automatic reconciliation remains the only normal conversion path.
        </p>
        <ul class="mt-4 space-y-3 text-sm text-gray-300">
          <li v-if="status.control?.automationEnabled !== true">
            Automation is paused. A protected administrator recovery action is required before scheduling resumes.
          </li>
          <li v-else-if="status.control?.circuitState !== 'closed'">
            The circuit is open. Classifarr will follow its protected recovery lifecycle before conversion resumes.
          </li>
          <li v-else-if="(status.inventory?.unresolvedCount ?? 0) > 0">
            Classifarr will retry eligible policies automatically and retain bounded blocker reasons for policies that still need lifecycle resolution.
          </li>
          <li v-else>
            Eligible policies will continue to reconcile on the scheduler without a confirmation dialog or manual batch selection.
          </li>
        </ul>
      </article>
    </section>

    <section
      v-if="status && status.blockerReasonGroups?.length"
      class="overflow-hidden rounded-lg border border-gray-700 bg-background-light"
      aria-labelledby="reconciliation-blockers-heading"
    >
      <div class="border-b border-gray-700 p-5">
        <h2
          id="reconciliation-blockers-heading"
          class="text-lg font-semibold"
        >
          Current blocker groups
        </h2>
        <p class="mt-1 text-sm text-gray-400">
          Grouped, bounded reason IDs explain why automatic reconciliation is waiting.
        </p>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <caption class="sr-only">
            Current native intent reconciliation blocker groups
          </caption>
          <thead class="bg-background text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th
                scope="col"
                class="px-5 py-3"
              >
                State
              </th>
              <th
                scope="col"
                class="px-5 py-3"
              >
                Reason
              </th>
              <th
                scope="col"
                class="px-5 py-3 text-right"
              >
                Policies
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800">
            <tr
              v-for="group in status.blockerReasonGroups"
              :key="`${group.outcomeState}:${group.reasonId}`"
            >
              <td class="px-5 py-3 text-gray-200">
                {{ formatId(group.outcomeState) }}
              </td>
              <td class="px-5 py-3 text-gray-300">
                {{ formatId(group.reasonId) }}
              </td>
              <td class="px-5 py-3 text-right text-white">
                {{ group.policyCount }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <PolicyNativeIntentReconciliationRemediationInventory
      v-if="status || remediationInventory"
      :inventory="remediationInventory"
      :loading="remediationLoading"
      :focus-policy-id="focusPolicyId"
      @edit-policy="openPolicyEditor"
    />

    <PolicyPurposeCoverageReview
      v-if="status || purposeCoverageReview"
      ref="purposeCoverageReviewElement"
      :review="purposeCoverageReview"
      :loading="purposeCoverageLoading"
      @edit-policy="openPolicyEditor"
      @review-evidence="reviewPolicyEvidence"
    />

    <PolicyScopedEvidenceDigest
      v-if="focusPolicyId"
      ref="policyScopedEvidenceDigestElement"
      :digest="policyScopedEvidenceDigest"
      :loading="policyScopedEvidenceDigestLoading"
    />

    <div
      v-if="policyEditorError"
      class="rounded border border-red-500/50 bg-red-950/30 p-4 text-sm text-red-100"
      role="alert"
    >
      {{ policyEditorError }}
    </div>

    <div
      v-if="policyEditorFeedback"
      class="rounded border border-green-500/50 bg-green-950/30 p-4 text-sm text-green-100"
      role="status"
      aria-live="polite"
    >
      {{ policyEditorFeedback }}
    </div>

    <p
      v-if="!status && !isLoading && !errorMessage"
      class="rounded border border-gray-700 bg-background-light p-5 text-sm text-gray-400"
    >
      Loading native intent reconciliation status...
    </p>
  </div>

  <PolicyBuilderModal
    v-if="editingPolicy"
    v-model="policyEditorOpen"
    :policy="editingPolicy"
    :library-id="editingPolicy.library_id"
    :compatibility-purpose-suggestion="compatibilityPurposeSuggestion"
    :submit-policy="saveRemediationPolicy"
    @close="closePolicyEditor"
  />
</template>

<script setup>
import { computed, defineAsyncComponent, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PolicyNativeIntentReconciliationRemediationInventory from '@/components/policies/PolicyNativeIntentReconciliationRemediationInventory.vue'
import PolicyPurposeCoverageReview from '@/components/policies/PolicyPurposeCoverageReview.vue'
import PolicyScopedEvidenceDigest from '@/components/policies/PolicyScopedEvidenceDigest.vue'
import {
  getPolicy,
  getPolicyNativeIntentReconciliationPurposeSuggestion,
  updatePolicy,
} from '@/api/policiesApi'
import { usePolicyNativeIntentReconciliationStatus } from '@/composables/usePolicyNativeIntentReconciliationStatus'
import { usePolicyNativeIntentReconciliationRemediationInventory } from '@/composables/usePolicyNativeIntentReconciliationRemediationInventory'
import { usePolicyPurposeCoverageReview } from '@/composables/usePolicyPurposeCoverageReview'
import { usePolicyScopedEvidenceDigest } from '@/composables/usePolicyScopedEvidenceDigest'
import {
  isPolicyConfirmationEvidenceReviewFocus,
} from '@/utils/policyConfirmationEvidenceReviewHandoff'

const route = useRoute()
const router = useRouter()
const PolicyBuilderModal = defineAsyncComponent(() =>
  import('@/components/policies/PolicyBuilderModal.vue')
)
const {
  status,
  isLoading: statusLoading,
  errorMessage: statusErrorMessage,
  loadStatus,
} = usePolicyNativeIntentReconciliationStatus()
const {
  inventory: remediationInventory,
  isLoading: remediationLoading,
  errorMessage: remediationErrorMessage,
  loadInventory: loadRemediationInventory,
} = usePolicyNativeIntentReconciliationRemediationInventory()
const {
  review: purposeCoverageReview,
  isLoading: purposeCoverageLoading,
  errorMessage: purposeCoverageErrorMessage,
  loadReview: loadPurposeCoverageReview,
} = usePolicyPurposeCoverageReview()
const {
  digest: policyScopedEvidenceDigest,
  isLoading: policyScopedEvidenceDigestLoading,
  errorMessage: policyScopedEvidenceDigestErrorMessage,
  loadDigest: loadPolicyScopedEvidenceDigest,
} = usePolicyScopedEvidenceDigest()
const editingPolicy = ref(null)
const policyEditorOpen = ref(false)
const policyEditorError = ref('')
const policyEditorFeedback = ref('')
const compatibilityPurposeSuggestion = ref(null)
const purposeCoverageReviewElement = ref(null)
const policyScopedEvidenceDigestElement = ref(null)
const isLoading = computed(() => (
  statusLoading.value || remediationLoading.value || purposeCoverageLoading.value ||
  policyScopedEvidenceDigestLoading.value
))
const errorMessage = computed(() => (
  statusErrorMessage.value || remediationErrorMessage.value || purposeCoverageErrorMessage.value ||
  policyScopedEvidenceDigestErrorMessage.value
))

const STATUS_DETAILS = {
  ready: { label: 'Automation healthy', description: 'Automatic reconciliation is enabled and has no unresolved policy inventory.', tone: 'green' },
  attention_required: { label: 'Automation needs attention', description: 'Automatic reconciliation is enabled, but bounded unresolved policy or recent failure evidence needs review.', tone: 'yellow' },
  automation_paused: { label: 'Automation paused', description: 'Automatic reconciliation is paused by a protected control state.', tone: 'yellow' },
  circuit_open: { label: 'Circuit recovery required', description: 'Automatic reconciliation is paused while the protected circuit recovery lifecycle runs.', tone: 'red' },
  control_unavailable: { label: 'Control unavailable', description: 'Classifarr cannot confirm that automatic reconciliation is safe to run.', tone: 'red' },
}

const statusDetails = computed(() => STATUS_DETAILS[status.value?.statusId] || {
  label: 'Status unavailable',
  description: 'Classifarr returned an unrecognized reconciliation status.',
  tone: 'yellow',
})
const statusLabel = computed(() => statusDetails.value.label)
const statusDescription = computed(() => statusDetails.value.description)
const automationLabel = computed(() => {
  if (status.value?.control?.available === false) return 'Unavailable'
  return status.value?.control?.automationEnabled !== false ? 'Enabled' : 'Paused'
})
const statusClass = computed(() => ({
  green: 'border-green-500/50 bg-green-950/20',
  yellow: 'border-yellow-500/50 bg-yellow-950/20',
  red: 'border-red-500/50 bg-red-950/20',
}[statusDetails.value.tone]))
const statusBadgeClass = computed(() => ({
  green: 'border-green-500/60 text-green-200',
  yellow: 'border-yellow-500/60 text-yellow-200',
  red: 'border-red-500/60 text-red-200',
}[statusDetails.value.tone]))
const deferredOrBlockedCount = computed(() => (
  (status.value?.latestRun?.counts?.deferredCount ?? 0) +
  (status.value?.latestRun?.counts?.blockedCount ?? 0)
))
const focusPolicyId = computed(() => {
  const policyId = Number(route.query?.policy)
  return Number.isInteger(policyId) && policyId > 0 ? policyId : null
})
const focusPurposeCoverageReview = computed(() => (
  isPolicyConfirmationEvidenceReviewFocus(route.query?.focus)
))
const focusPolicyScopedEvidenceDigest = computed(() => route.query?.focus === 'evidence-digest')

const loadReconciliationView = async () => {
  await Promise.all([
    loadStatus(),
    loadRemediationInventory(),
    loadPurposeCoverageReview(),
    loadPolicyScopedEvidenceDigest(focusPolicyId.value),
  ])
}

const focusRequestedRemediation = async () => {
  const policyId = focusPolicyId.value
  if (!policyId || typeof document === 'undefined') return

  await nextTick()
  document.getElementById(`policy-reconciliation-remediation-${policyId}`)?.focus()
}

const focusRequestedPurposeCoverageReview = async () => {
  if (!focusPurposeCoverageReview.value || !purposeCoverageReview.value) return

  await nextTick()
  purposeCoverageReviewElement.value?.focus?.()
}

const focusRequestedPolicyScopedEvidenceDigest = async () => {
  if (!focusPolicyScopedEvidenceDigest.value || !policyScopedEvidenceDigest.value) return

  await nextTick()
  policyScopedEvidenceDigestElement.value?.focus?.()
}

const reviewPolicyEvidence = async entry => {
  const policyId = Number(entry?.policy?.id)
  if (!Number.isInteger(policyId) || policyId <= 0) return

  await router.push({
    name: 'PolicyNativeIntentReconciliation',
    query: {
      policy: String(policyId),
      focus: 'evidence-digest',
    },
  })
}

const openPolicyEditor = async entry => {
  const policyId = Number(entry?.policy?.id)
  if (!Number.isInteger(policyId) || policyId <= 0) return

  policyEditorError.value = ''
  policyEditorFeedback.value = ''
  editingPolicy.value = null
  compatibilityPurposeSuggestion.value = null

  try {
    editingPolicy.value = await getPolicy(policyId)
    try {
      const suggestion = await getPolicyNativeIntentReconciliationPurposeSuggestion(policyId)
      const {
        adaptPolicyNativeIntentReconciliationPurposeSuggestion,
      } = await import('@/utils/policyNativeIntentReconciliationPurposeSuggestionPresentation')
      compatibilityPurposeSuggestion.value = adaptPolicyNativeIntentReconciliationPurposeSuggestion({
        suggestion,
        expectedPolicyId: policyId,
      }).presentation
    } catch {
      compatibilityPurposeSuggestion.value = null
    }
    policyEditorOpen.value = true
  } catch {
    policyEditorError.value = 'Classifarr could not load the current policy for remediation. Refresh the inventory and try again.'
  }
}

const closePolicyEditor = () => {
  policyEditorOpen.value = false
  editingPolicy.value = null
  compatibilityPurposeSuggestion.value = null
}

const saveRemediationPolicy = async payload => {
  const policyId = Number(editingPolicy.value?.id)
  if (!Number.isInteger(policyId) || policyId <= 0) {
    throw new Error('The policy is no longer available for remediation.')
  }

  await updatePolicy(policyId, payload)
  closePolicyEditor()
  policyEditorFeedback.value = 'Policy saved. The protected reconciliation scheduler will independently re-evaluate the current configuration; this page does not convert policies.'
  await loadReconciliationView()
}

function formatId(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Unavailable'
  return value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase())
}

function formatTimestamp(value) {
  if (!value) return 'Not scheduled'
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? 'Unavailable' : timestamp.toLocaleString()
}

function formatRuntime(runtime) {
  const appVersion = typeof runtime?.appVersion === 'string' ? runtime.appVersion : ''
  const buildRevision = typeof runtime?.buildRevision === 'string' ? runtime.buildRevision : ''

  if (!appVersion || appVersion === 'unknown') return 'Unknown (historical run)'
  return buildRevision ? `App ${appVersion} | revision ${buildRevision}` : `App ${appVersion}`
}

watch(focusPolicyId, loadPolicyScopedEvidenceDigest)
watch([focusPolicyId, remediationInventory], focusRequestedRemediation)
watch([focusPurposeCoverageReview, purposeCoverageReview], focusRequestedPurposeCoverageReview)
watch(
  [focusPolicyScopedEvidenceDigest, policyScopedEvidenceDigest],
  focusRequestedPolicyScopedEvidenceDigest
)

onMounted(async () => {
  await loadReconciliationView()
  await focusRequestedRemediation()
  await focusRequestedPurposeCoverageReview()
  await focusRequestedPolicyScopedEvidenceDigest()
})
</script>
