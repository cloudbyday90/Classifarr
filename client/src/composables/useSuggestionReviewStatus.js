/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { computed, onBeforeUnmount, shallowRef } from 'vue'
import api from '@/api'
import { readObservedSuggestionStatus } from '@/utils/suggestionReviewAcknowledgement'

const observations = {
  checking: 'Checking the saved status…',
  pending: 'It was pending when checked. The original request may still finish. Open the proposal again to start a new review.',
  applied: 'Saved status is applied.',
  rejected: 'Saved status is rejected.',
  superseded: 'Saved status is superseded.',
  missing: 'The saved proposal is unavailable.',
  unknown: 'The saved status could not be verified.',
}

export function useSuggestionReviewStatus(onTerminal) {
  const current = shallowRef(null)
  const checking = computed(() => current.value?.status === 'checking')
  const message = computed(() => {
    const observation = current.value
    return observation ? `Review response for suggestion ${observation.target.id} was not confirmed. ${observations[observation.status]}` : ''
  })

  async function check() {
    if (!current.value || checking.value) return
    const request = { target: current.value.target, status: 'checking' }
    current.value = request
    let status
    try {
      const proposal = await api.getSuggestionProposal(request.target.id, { reconcile: true })
      status = readObservedSuggestionStatus(request.target, proposal)
    } catch (error) {
      status = error?.response?.status === 404 ? 'missing' : 'unknown'
    }
    if (current.value !== request) return
    current.value = { target: request.target, status }
    if (status === 'applied' || status === 'rejected' || status === 'superseded') void onTerminal(request.target.id)
  }

  function start(suggestion) {
    const target = { id: suggestion.id, policyId: suggestion.policy_id, type: suggestion.suggestion_type }
    current.value = { target, status: 'unknown' }
    return check()
  }

  function clear() {
    current.value = null
  }

  onBeforeUnmount(clear)
  return { message, checking, start, check, clear }
}
