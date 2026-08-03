/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { ref } from 'vue'
import api from '@/api'
import { primaryPolicyOption } from '@/utils/needsAttention'
import {
  buildNativePendingQuestionPresentation,
  isNativePendingQuestion,
} from '@/utils/nativePendingQuestionPresentation'

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

  function buildResolutionPayload(item, option, selectedOptionLabel, libraryId) {
    const question = item?.policy_question && typeof item.policy_question === 'object'
      ? item.policy_question
      : null
    const isNative = isNativePendingQuestion(question)

    return {
      library_id: libraryId,
      selected_option: selectedOptionLabel || option?.label || option?.value || 'Confirm',
      resolved_by: 'admin',
      generate_rule: !isNative,
    }
  }

  async function resolveWithOption(item, option, selectedOptionLabel = null) {
    if (item?.policy_question_stale) {
      setActionError(`Policy question for "${item.title}" must be refreshed before it can be resolved.`)
      return
    }
    const question = item?.policy_question
    const nativePresentation = buildNativePendingQuestionPresentation(question)
    if (isNativePendingQuestion(question) && !nativePresentation) {
      setActionError(`Native review data for "${item.title}" cannot be safely resolved. Retry Classification to refresh it.`)
      return
    }
    const libraryId = nativePresentation
      ? nativePresentation.destination.libraryId
      : Number(option?.library_id || 0)
    if (!libraryId) {
      toggleChangeMode(item.id)
      setActionError(`Library mapping is missing for "${item.title}". Choose a library with Change.`)
      return
    }

    await runActionWithBusy(`resolve-${item.id}`, async () => {
      const response = await api.resolvePendingClassification(item.id, {
        ...buildResolutionPayload(item, option, selectedOptionLabel, libraryId),
      })
      setRoutingOutcomeError(item.title, response)
      changeMode.value = { ...changeMode.value, [item.id]: false }
    })
  }

  async function resolveManualChange(item) {
    if (item?.policy_question_stale) {
      setActionError(`Policy question for "${item.title}" must be refreshed before it can be resolved.`)
      return
    }
    const libraryId = Number(manualLibraryByItemId.value[item.id] || 0)
    if (!libraryId) return

    const nativePresentation = buildNativePendingQuestionPresentation(item?.policy_question)
    if (isNativePendingQuestion(item?.policy_question) && !nativePresentation) {
      setActionError(`Native review data for "${item.title}" cannot be safely resolved. Retry Classification to refresh it.`)
      return
    }

    await runActionWithBusy(`resolve-${item.id}`, async () => {
      const response = await api.resolvePendingClassification(item.id, {
        ...buildResolutionPayload(
          item,
          null,
          nativePresentation?.alternativeDestination.selectedOptionLabel || 'Manual selection',
          libraryId,
        ),
      })
      setRoutingOutcomeError(item.title, response)
      changeMode.value = { ...changeMode.value, [item.id]: false }
    })
  }

  async function confirmAllNeedsAttention() {
    await runActionWithBusy('confirm-all', async () => {
      const routingWarnings = []
      const skippedNativeItems = []
      const skippedStaleItems = []

      for (const item of needsAttentionItems.value) {
        if (item?.policy_question_stale) {
          skippedStaleItems.push(item)
          continue
        }
        if (isNativePendingQuestion(item?.policy_question)) {
          skippedNativeItems.push(item)
          continue
        }
        const option = primaryPolicyOption(item)
        if (!option?.library_id) continue
        const response = await api.resolvePendingClassification(item.id, buildResolutionPayload(
          item,
          option,
          option.label || option.value || 'Confirm',
          Number(option.library_id),
        ))

        const warning = getRoutingOutcomeMessage(item.title, response)
        if (warning) routingWarnings.push(warning)
      }

      if (skippedNativeItems.length > 0 || skippedStaleItems.length > 0) {
        const messages = []
        if (skippedNativeItems.length > 0) {
          messages.push(`Confirm All skipped ${skippedNativeItems.length} native review ${skippedNativeItems.length === 1 ? 'item' : 'items'}; choose an explicit outcome for each item.`)
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
      const response = await api.retryClassifications([item.id], { purgeLearning: true })
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

      const response = await api.retryClassifications(ids, { purgeLearning: true })
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
    resolveManualChange,
    resolveWithOption,
    retryAllNeedsAttention,
    retryNeedsAttentionItem,
    toggleChangeMode,
    updateManualLibrarySelection,
  }
}
