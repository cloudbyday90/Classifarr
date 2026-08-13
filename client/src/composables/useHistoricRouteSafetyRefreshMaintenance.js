/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { computed, onMounted, onUnmounted, ref } from 'vue'

import api from '@/api'
import {
  isHistoricRouteSafetyRefreshReceiptInFlight,
} from '@/utils/historicRouteSafetyRefreshPresentation'

const DEFAULT_PAGE_LIMIT = 25
const RECEIPT_POLL_INTERVAL_MS = 5000
const RECEIPT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function positiveInteger(value) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function reportFromResponse(response) {
  return response?.data ?? response
}

function readFailureMessage(error, fallback) {
  const status = Number(error?.response?.status)
  if (status === 401) return 'Sign in to use this administrator maintenance view.'
  if (status === 403) return 'Administrator authorization is required for this maintenance action.'
  if (status === 404) return 'The requested receipt is no longer available.'
  return fallback
}

function isSafeInventoryReport(report) {
  return report?.mode === 'read_only' && report?.validation?.ok === true && Array.isArray(report.records)
}

function isSafeReceiptReport(report, receiptId) {
  return report?.mode === 'read_only' &&
    report?.receipt?.retryReceipt === receiptId &&
    Array.isArray(report.records)
}

function isSafeRecentReceiptDiscoveryReport(report) {
  if (report?.mode !== 'read_only') return false
  if (report.recentReceipt === null) return true
  return asReceiptId(report?.recentReceipt?.retryReceipt) !== null
}

function asReceiptId(value) {
  const receiptId = typeof value === 'string' ? value.trim() : ''
  return RECEIPT_ID_PATTERN.test(receiptId) ? receiptId : null
}

export function useHistoricRouteSafetyRefreshMaintenance() {
  const inventory = ref(null)
  const receipt = ref(null)
  const receiptId = ref(null)
  const selectedClassificationIds = ref([])
  const inventoryError = ref('')
  const receiptError = ref('')
  const actionMessage = ref('')
  const actionError = ref('')
  const selectionMessage = ref('')
  const isInventoryLoading = ref(false)
  const isReceiptLoading = ref(false)
  const isExecuting = ref(false)
  const cursorHistory = ref([null])
  const cursorIndex = ref(0)

  let receiptPollTimer = null
  let disposed = false
  let receiptRequestSequence = 0
  let recentReceiptDiscoveryRequestSequence = 0

  const records = computed(() => Array.isArray(inventory.value?.records) ? inventory.value.records : [])
  const maximumSelectionCount = computed(() => {
    const count = positiveInteger(inventory.value?.operatorRetryPlan?.maximumClassificationIds)
    return count || 50
  })
  const selectedCount = computed(() => selectedClassificationIds.value.length)
  const currentPageNumber = computed(() => cursorIndex.value + 1)
  const canLoadPreviousPage = computed(() => cursorIndex.value > 0)
  const canLoadNextPage = computed(() => inventory.value?.pagination?.hasNextPage === true &&
    positiveInteger(inventory.value?.pagination?.nextCursor) !== null)
  const isReceiptInFlight = computed(() => isHistoricRouteSafetyRefreshReceiptInFlight(receipt.value))

  function stopReceiptPolling() {
    if (receiptPollTimer !== null) {
      clearTimeout(receiptPollTimer)
      receiptPollTimer = null
    }
  }

  function scheduleReceiptPolling() {
    stopReceiptPolling()
    if (disposed || !receiptId.value || !isReceiptInFlight.value) return

    receiptPollTimer = setTimeout(async () => {
      receiptPollTimer = null
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return
      }
      await loadReceipt()
    }, RECEIPT_POLL_INTERVAL_MS)
  }

  function currentCursor() {
    return cursorHistory.value[cursorIndex.value] ?? null
  }

  function isSelected(classificationId) {
    return selectedClassificationIds.value.includes(positiveInteger(classificationId))
  }

  function clearSelection() {
    selectedClassificationIds.value = []
    selectionMessage.value = ''
  }

  function toggleSelection(classificationId) {
    const normalizedId = positiveInteger(classificationId)
    if (!normalizedId) return

    const selected = new Set(selectedClassificationIds.value)
    if (selected.has(normalizedId)) {
      selected.delete(normalizedId)
      selectedClassificationIds.value = [...selected]
      selectionMessage.value = ''
      return
    }

    if (selected.size >= maximumSelectionCount.value) {
      selectionMessage.value = `Select at most ${maximumSelectionCount.value} records for one controlled retry.`
      return
    }

    selected.add(normalizedId)
    selectedClassificationIds.value = [...selected]
    selectionMessage.value = ''
  }

  function selectVisibleRecords() {
    const selected = new Set(selectedClassificationIds.value)
    for (const record of records.value) {
      const classificationId = positiveInteger(record?.classificationId)
      if (!classificationId || selected.size >= maximumSelectionCount.value) break
      selected.add(classificationId)
    }
    selectedClassificationIds.value = [...selected]
    selectionMessage.value = selected.size >= maximumSelectionCount.value && records.value.some(
      record => !selected.has(positiveInteger(record?.classificationId)),
    )
      ? `Selection is limited to ${maximumSelectionCount.value} records.`
      : ''
  }

  async function loadInventory({ reset = false, cursor = undefined } = {}) {
    const requestedCursor = reset
      ? null
      : (cursor === undefined ? currentCursor() : positiveInteger(cursor))
    isInventoryLoading.value = true
    inventoryError.value = ''

    try {
      const report = await api.getHistoricRouteSafetyRefreshInventory(
        requestedCursor ? { cursor: requestedCursor, limit: DEFAULT_PAGE_LIMIT } : { limit: DEFAULT_PAGE_LIMIT },
      )
      if (!isSafeInventoryReport(report)) {
        throw new TypeError('Historic route-safety inventory was not a safe read-only report.')
      }

      if (reset) {
        cursorHistory.value = [null]
        cursorIndex.value = 0
      }
      inventory.value = report
      return report
    } catch (error) {
      inventoryError.value = readFailureMessage(error, 'Unable to load the historic route-safety inventory.')
      return null
    } finally {
      isInventoryLoading.value = false
    }
  }

  async function loadNextPage() {
    const nextCursor = positiveInteger(inventory.value?.pagination?.nextCursor)
    if (!canLoadNextPage.value || !nextCursor) return null

    cursorHistory.value = [...cursorHistory.value.slice(0, cursorIndex.value + 1), nextCursor]
    cursorIndex.value += 1
    return loadInventory({ cursor: nextCursor })
  }

  async function loadPreviousPage() {
    if (!canLoadPreviousPage.value) return null

    cursorIndex.value -= 1
    return loadInventory({ cursor: currentCursor() })
  }

  async function loadReceipt() {
    const activeReceiptId = receiptId.value
    if (!activeReceiptId) return null

    stopReceiptPolling()
    receiptError.value = ''
    isReceiptLoading.value = true
    const requestSequence = ++receiptRequestSequence
    let loadedReceipt = null

    try {
      const report = await api.getHistoricRouteSafetyRefreshReceipt(activeReceiptId)
      if (disposed || requestSequence !== receiptRequestSequence || receiptId.value !== activeReceiptId) {
        return null
      }
      if (!isSafeReceiptReport(report, activeReceiptId)) {
        throw new TypeError('Historic route-safety receipt was not a safe read-only report.')
      }

      receipt.value = report
      loadedReceipt = report
      return report
    } catch (error) {
      if (!disposed && receiptId.value === activeReceiptId) {
        receiptError.value = readFailureMessage(error, 'Unable to refresh the controlled retry receipt.')
      }
      return null
    } finally {
      if (!disposed && requestSequence === receiptRequestSequence && receiptId.value === activeReceiptId) {
        isReceiptLoading.value = false
        if (loadedReceipt) scheduleReceiptPolling()
      }
    }
  }

  async function discoverRecentReceipt() {
    const requestSequence = ++recentReceiptDiscoveryRequestSequence
    if (receiptId.value || isExecuting.value) return null

    try {
      const report = await api.getHistoricRouteSafetyRefreshRecentReceipt()
      if (disposed || requestSequence !== recentReceiptDiscoveryRequestSequence || receiptId.value || isExecuting.value) {
        return null
      }
      if (!isSafeRecentReceiptDiscoveryReport(report)) {
        throw new TypeError('Historic route-safety recent receipt discovery was not a safe read-only report.')
      }

      const discoveredReceiptId = asReceiptId(report?.recentReceipt?.retryReceipt)
      if (!discoveredReceiptId) return report

      receiptId.value = discoveredReceiptId
      receipt.value = null
      receiptError.value = ''
      actionMessage.value = 'Resumed your recent controlled retry status.'
      await loadReceipt()
      return report
    } catch (error) {
      if (!disposed && requestSequence === recentReceiptDiscoveryRequestSequence && !receiptId.value) {
        actionError.value = readFailureMessage(error, 'Unable to check for a recent controlled retry.')
      }
      return null
    }
  }

  async function executeSelected() {
    if (!selectedClassificationIds.value.length) {
      selectionMessage.value = 'Select at least one record before starting a controlled retry.'
      return null
    }

    isExecuting.value = true
    recentReceiptDiscoveryRequestSequence += 1
    actionMessage.value = ''
    actionError.value = ''
    receiptError.value = ''

    try {
      const response = await api.executeHistoricRouteSafetyRefresh(selectedClassificationIds.value)
      const result = reportFromResponse(response)
      const nextReceiptId = asReceiptId(result?.retryReceipt)
      if (!nextReceiptId) {
        throw new TypeError('Historic route-safety retry did not return a valid receipt.')
      }

      receiptId.value = nextReceiptId
      receipt.value = null
      clearSelection()
      actionMessage.value = 'Controlled retry accepted. Checking its protected runtime receipt.'
      await loadReceipt()
      await loadInventory({ reset: true })
      return result
    } catch (error) {
      actionError.value = readFailureMessage(error, 'Unable to start the controlled historic retry.')
      return null
    } finally {
      isExecuting.value = false
    }
  }

  function clearReceipt() {
    stopReceiptPolling()
    receiptRequestSequence += 1
    recentReceiptDiscoveryRequestSequence += 1
    receipt.value = null
    receiptId.value = null
    receiptError.value = ''
    actionMessage.value = ''
    actionError.value = ''
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible' && isReceiptInFlight.value && !isReceiptLoading.value) {
      loadReceipt()
    }
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onUnmounted(() => {
    disposed = true
    stopReceiptPolling()
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return {
    actionError,
    actionMessage,
    canLoadNextPage,
    canLoadPreviousPage,
    clearReceipt,
    clearSelection,
    currentPageNumber,
    discoverRecentReceipt,
    executeSelected,
    inventory,
    inventoryError,
    isExecuting,
    isInventoryLoading,
    isReceiptInFlight,
    isReceiptLoading,
    isSelected,
    loadInventory,
    loadNextPage,
    loadPreviousPage,
    loadReceipt,
    maximumSelectionCount,
    receipt,
    receiptError,
    records,
    selectVisibleRecords,
    selectedClassificationIds,
    selectedCount,
    selectionMessage,
    toggleSelection,
  }
}
