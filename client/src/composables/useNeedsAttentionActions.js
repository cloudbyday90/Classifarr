/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { ref } from 'vue'
import api from '@/api'
import {
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS,
  buildPolicyQuestionAnswerPayload,
  policyQuestionAnswer,
} from '@/utils/policyQuestionAnswerContract'

export function useNeedsAttentionActions({
  activeLibraries,
  needsAttentionItems,
  runActionWithBusy,
  setActionError,
}) {
  const changeMode = ref({})
  const manualLibraryByItemId = ref({})

  function librariesForMediaType(mediaType) {
    if (!mediaType) return activeLibraries.value
    return activeLibraries.value.filter(library => library.media_type === mediaType)
  }

  function toggleChangeMode(itemId) {
    changeMode.value = { ...changeMode.value, [itemId]: !changeMode.value[itemId] }
    if (!Object.prototype.hasOwnProperty.call(manualLibraryByItemId.value, itemId)) {
      manualLibraryByItemId.value = { ...manualLibraryByItemId.value, [itemId]: null }
    }
  }

  function updateManualLibrarySelection({ itemId, value }) {
    manualLibraryByItemId.value = { ...manualLibraryByItemId.value, [itemId]: value }
  }

  function getRoutingOutcomeMessage(itemTitle, response) {
    const routingError = response?.data?.routingError
    const routingReason = response?.data?.routingReason
    if (response?.data?.routed === false && (routingError || routingReason)) {
      return `Resolved "${itemTitle}" but routing did not complete (${routingReason || routingError}).`
    }
    return ''
  }

  function setRoutingOutcomeError(itemTitle, response) {
    const message = getRoutingOutcomeMessage(itemTitle, response)
    if (message) setActionError(message)
  }

  function buildResolutionPayload(item, actionId, libraryId) {
    return buildPolicyQuestionAnswerPayload(
      policyQuestionAnswer(item),
      actionId,
      libraryId,
    )
  }

  async function resolveWithOption(item, answerSelection) {
    if (item?.policy_question_stale) {
      setActionError(`Policy question for "${item.title}" must be refreshed before it can be resolved.`)
      return
    }
    const actionId = answerSelection?.actionId
    const libraryId = Number(answerSelection?.destinationLibraryId || 0)
    const payload = buildResolutionPayload(item, actionId, libraryId)
    if (!payload) {
      setActionError(`Policy question for "${item.title}" is no longer valid. Retry Classification to refresh it.`)
      return
    }

    await runActionWithBusy(`resolve-${item.id}`, async () => {
      const response = await api.resolvePendingClassification(item.id, payload)
      setRoutingOutcomeError(item.title, response)
      changeMode.value = { ...changeMode.value, [item.id]: false }
    })
  }

  async function confirmAllNeedsAttention() {
    await runActionWithBusy('confirm-all', async () => {
      const routingWarnings = []
      const skippedStaleItems = []
      const skippedUnavailableItems = []

      for (const item of needsAttentionItems.value) {
        if (item?.policy_question_stale) {
          skippedStaleItems.push(item)
          continue
        }
        const answer = policyQuestionAnswer(item)
        const destination = answer?.candidate_destinations?.[0]
        const payload = buildResolutionPayload(
          item,
          POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION,
          destination?.library_id,
        )
        if (!payload) {
          skippedUnavailableItems.push(item)
          continue
        }
        const response = await api.resolvePendingClassification(item.id, payload)

        const warning = getRoutingOutcomeMessage(item.title, response)
        if (warning) routingWarnings.push(warning)
      }

      if (skippedUnavailableItems.length > 0 || skippedStaleItems.length > 0) {
        const messages = []
        if (skippedUnavailableItems.length > 0) {
          messages.push(`Confirm All skipped ${skippedUnavailableItems.length} item${skippedUnavailableItems.length === 1 ? '' : 's'} without a current confirm action; choose an explicit destination or retry Classification.`)
        }
        if (skippedStaleItems.length > 0) {
          messages.push(`Confirm All skipped ${skippedStaleItems.length} stale ${skippedStaleItems.length === 1 ? 'item' : 'items'}; retry Classification to refresh each question.`)
        }
        const message = messages.join(' ')
        setActionError(routingWarnings.length > 0 ? `${message} ${routingWarnings.join(' ')}` : message)
      } else if (routingWarnings.length === 1) {
        setActionError(routingWarnings[0])
      } else if (routingWarnings.length > 1) {
        setActionError(`Confirm All completed, but routing did not finish for ${routingWarnings.length} items: ${routingWarnings.join(' ')}`)
      }
    })
  }

  async function retryNeedsAttentionItem(item) {
    await runActionWithBusy(`retry-classification-${item.id}`, async () => {
      const response = await api.retryClassifications([item.id])
      const result = Array.isArray(response?.data?.results) ? response.data.results[0] : null
      if (!result || result.queued !== true) {
        const reason = result?.reasonCode || result?.error || 'retry_not_queued'
        throw new Error(`Retry not queued for "${item.title}" (${reason})`)
      }
    })
  }

  async function retryAllNeedsAttention() {
    await runActionWithBusy('retry-all-classifications', async () => {
      const ids = needsAttentionItems.value
        .map(item => Number(item.id))
        .filter(id => Number.isInteger(id) && id > 0)

      if (!ids.length) return

      const response = await api.retryClassifications(ids)
      const data = response?.data || {}
      const queued = Number(data.queued || 0)
      const skipped = Number(data.skipped || 0)
      const failed = Number(data.failed || 0)

      if (queued === 0 && (skipped > 0 || failed > 0)) {
        throw new Error(`Retry Classification All did not queue any items (skipped ${skipped}, failed ${failed})`)
      }

      if (skipped > 0 || failed > 0) {
        setActionError(`Retry Classification All queued ${queued}, skipped ${skipped}, failed ${failed}.`)
      }
    })
  }

  return {
    changeMode,
    confirmAllNeedsAttention,
    librariesForMediaType,
    manualLibraryByItemId,
    resolveWithOption,
    retryAllNeedsAttention,
    retryNeedsAttentionItem,
    toggleChangeMode,
    updateManualLibrarySelection,
  }
}
