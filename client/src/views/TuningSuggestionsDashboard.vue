<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="space-y-5 p-4 sm:p-8">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <h1
        ref="dashboardHeading"
        tabindex="-1"
        class="text-2xl font-bold focus-visible:outline-2 focus-visible:outline-primary"
      >
        Policy Tuning Suggestions
      </h1>
      <div class="flex flex-wrap gap-3">
        <select
          v-model="statusFilter"
          aria-label="Suggestion status"
          class="rounded border border-gray-600 bg-background-light px-3 py-2"
        >
          <option value="pending">
            Pending
          </option>
          <option value="applied">
            Applied
          </option>
          <option value="rejected">
            Rejected
          </option>
          <option value="superseded">
            Superseded
          </option>
          <option value="all">
            All
          </option>
        </select>
        <select
          v-if="canReview"
          v-model="policyFilter"
          aria-label="Policy"
          class="min-w-0 max-w-full rounded border border-gray-600 bg-background-light px-3 py-2"
        >
          <option value="">
            All Policies
          </option>
          <option
            v-for="policy in policies"
            :key="policy.id"
            :value="policy.id"
          >
            {{ policy.name }}
          </option>
        </select>
      </div>
    </header>

    <div
      v-if="reviewerCheckFailed"
      class="flex flex-wrap items-center gap-2"
    >
      <p
        role="alert"
        class="text-sm text-gray-300"
      >
        Could not check review permissions. You can still inspect suggestions.
      </p>
      <Button
        variant="outline-solid"
        size="sm"
        :aria-disabled="checkingReviewer"
        @click="loadReviewer"
      >
        Retry permissions check
      </Button>
    </div>

    <p
      ref="listStatus"
      role="status"
      aria-atomic="true"
      tabindex="-1"
      class="text-sm text-gray-300"
    >
      {{ statusMessage }}
    </p>
    <nav
      aria-label="Suggestion pages"
      class="flex flex-wrap items-center gap-2"
    >
      <Button
        variant="outline-solid"
        size="sm"
        :aria-disabled="!canShowNewer"
        class="focus-visible:outline-2 focus-visible:outline-primary aria-disabled:opacity-60"
        @click="showNewer"
      >
        Newer
      </Button>
      <Button
        variant="outline-solid"
        size="sm"
        :aria-disabled="!canShowOlder"
        class="focus-visible:outline-2 focus-visible:outline-primary aria-disabled:opacity-60"
        @click="showOlder"
      >
        Older
      </Button>
      <Button
        v-if="state === 'error' || retryRequest"
        variant="outline-solid"
        size="sm"
        :aria-disabled="Boolean(retryRequest)"
        class="focus-visible:outline-2 focus-visible:outline-primary aria-disabled:opacity-60"
        @click="retryList"
      >
        Retry suggestions
      </Button>
    </nav>

    <section
      aria-label="Suggestion results"
      :aria-busy="state === 'loading'"
      class="space-y-4"
    >
      <SuggestionCard
        v-for="suggestion in page?.items ?? []"
        :key="suggestion.id"
        :suggestion="suggestion"
        @view-details="showDetails"
      />
    </section>

    <SuggestionDetailsDialog
      v-if="selectedSuggestion"
      :key="selectedSuggestion.id"
      :suggestion="selectedSuggestion"
      :can-review="canReview"
      :busy="reviewBusy"
      :fallback-focus-target="getReviewFallbackFocus"
      @close="selectedSuggestion = null"
      @apply="applySuggestion"
      @reject="showRejectModal"
    />

    <RejectModal
      v-if="rejectingSuggestion"
      :suggestion="rejectingSuggestion"
      :busy="reviewBusy"
      :fallback-focus-target="getReviewFallbackFocus"
      @confirm="confirmReject"
      @cancel="rejectingSuggestion = null"
    />
  </div>
</template>

<script setup>
import { ref, shallowRef, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import api from '@/api'
import Button from '@/components/common/Button.vue'
import SuggestionCard from '@/components/suggestions/SuggestionCard.vue'
import SuggestionDetailsDialog from '@/components/suggestions/SuggestionDetailsDialog.vue'
import RejectModal from '@/components/suggestions/RejectModal.vue'
import { useSuggestionPages } from '@/composables/useSuggestionPages'
import { isSuggestionAdministratorRefusal, isSuggestionReviewConflict } from '@/utils/suggestionReviewErrors'

const policies = ref([])
const canReview = ref(false)
const reviewerCheckFailed = ref(false)
const checkingReviewer = ref(false)
const reviewBusy = ref(false)
const retryRequest = shallowRef(null)
const statusFilter = ref('pending')
const policyFilter = ref('')
const selectedSuggestion = ref(null)
const rejectingSuggestion = ref(null)
const dashboardHeading = useTemplateRef('dashboardHeading')
const listStatus = useTemplateRef('listStatus')
let reviewOpener = null
let active = true

const { page, state, statusMessage, canShowNewer, canShowOlder, showNewer, showOlder, retry, reset } =
  useSuggestionPages(statusFilter, policyFilter)

watch([statusFilter, policyFilter], () => { retryRequest.value = null }, { flush: 'sync' })

async function loadReviewer(event) {
  if (checkingReviewer.value) return
  const button = event?.currentTarget
  checkingReviewer.value = true
  let user
  try {
    user = await api.getUserProfile()
    if (typeof user?.role !== 'string') throw new Error('Invalid user profile')
  } catch {
    if (active) reviewerCheckFailed.value = true
    return
  } finally {
    checkingReviewer.value = false
  }

  if (!active) return
  if (button && document.activeElement === button) dashboardHeading.value?.focus()
  reviewerCheckFailed.value = false
  if (user.role !== 'admin') return
  canReview.value = true
  try {
    const result = await api.getPolicies()
    if (active && Array.isArray(result)) policies.value = result
  } catch (error) {
    if (active) console.error('Failed to load suggestion policies:', error)
  }
}

async function retryList(event) {
  if (retryRequest.value) return
  const button = event.currentTarget
  const request = {}
  retryRequest.value = request
  const loaded = await retry()
  if (!active || retryRequest.value !== request) return
  if (loaded && document.activeElement === button) listStatus.value?.focus()
  retryRequest.value = null
}

function showDetails(suggestion, event) {
  reviewOpener = event?.currentTarget ?? null
  selectedSuggestion.value = suggestion
}

function getReviewFallbackFocus() {
  return reviewOpener?.isConnected ? reviewOpener : dashboardHeading.value
}

function canActOn(proposal) {
  return canReview.value && !reviewBusy.value && proposal?.status === 'pending' &&
    selectedSuggestion.value?.id === proposal.id
}

function showRejectModal(proposal) {
  if (!canActOn(proposal)) return
  rejectingSuggestion.value = proposal
  selectedSuggestion.value = null
}

function refreshAfterReview() {
  selectedSuggestion.value = null
  rejectingSuggestion.value = null
  retryRequest.value = null
  return reset()
}

async function reviewSuggestion(action, suggestion, reason) {
  reviewBusy.value = true
  try {
    if (action === 'apply') await api.applySuggestion(suggestion.id)
    else await api.rejectSuggestion(suggestion.id, reason)
    if (!active) return
    alert(action === 'apply' ? 'Suggestion applied successfully!' : 'Suggestion rejected')
    await refreshAfterReview()
  } catch (error) {
    if (!active) return
    if (isSuggestionAdministratorRefusal(error)) {
      alert(`Ask a Classifarr administrator to review and ${action} this suggestion.`)
    } else if (isSuggestionReviewConflict(error)) {
      await refreshAfterReview()
      if (!active) return
      const code = error.response?.data?.code
      alert(code === 'SUGGESTION_EVIDENCE_BUSY'
        ? 'Suggestion evidence is being updated. Please try again later.'
        : code === 'SUGGESTION_EVIDENCE_STALE' || code === 'SUGGESTION_EVIDENCE_REQUIRED'
          ? 'Suggestion evidence needs refreshing. Run analysis before applying a new suggestion.'
          : 'This suggestion has changed and was not updated by this request.')
    } else {
      console.error(`Failed to ${action} suggestion:`, error)
      alert(`Failed to ${action} suggestion: ${error.message}`)
    }
  } finally {
    reviewBusy.value = false
  }
}

function applySuggestion(proposal) {
  if (!canActOn(proposal) || proposal.proposal_status !== 'available' ||
      !confirm('Are you sure you want to apply this suggestion?')) return
  return reviewSuggestion('apply', proposal)
}

function confirmReject(reason) {
  if (!canReview.value || reviewBusy.value || !rejectingSuggestion.value) return
  return reviewSuggestion('reject', rejectingSuggestion.value, reason)
}

onMounted(loadReviewer)
onBeforeUnmount(() => { active = false })
</script>
