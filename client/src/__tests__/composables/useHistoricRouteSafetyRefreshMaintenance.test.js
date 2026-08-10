/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    executeHistoricRouteSafetyRefresh: vi.fn(),
    getHistoricRouteSafetyRefreshInventory: vi.fn(),
    getHistoricRouteSafetyRefreshReceipt: vi.fn(),
  },
}))

vi.mock('@/api', () => ({ default: apiMock }))

import { useHistoricRouteSafetyRefreshMaintenance } from '@/composables/useHistoricRouteSafetyRefreshMaintenance'

const RETRY_RECEIPT = '6c5a0839-0ae0-44a7-b3c4-18f413b58b13'

const inventoryReport = {
  mode: 'read_only',
  validation: { ok: true },
  records: [
    {
      classificationId: 41,
      pendingStatus: 'awaiting_decision',
      candidateItem: { title: 'First historical item', year: 2026, media_type: 'movie' },
    },
    {
      classificationId: 42,
      pendingStatus: 'awaiting_decision',
      candidateItem: { title: 'Second historical item', year: 2026, media_type: 'movie' },
    },
    {
      classificationId: 43,
      pendingStatus: 'awaiting_decision',
      candidateItem: { title: 'Third historical item', year: 2026, media_type: 'tv' },
    },
  ],
  pagination: { cursor: null, nextCursor: 44, hasNextPage: true },
  operatorRetryPlan: { maximumClassificationIds: 2 },
}

function receiptReport(reconciliationStatusId = 'runtime_completed') {
  return {
    mode: 'read_only',
    receipt: {
      retryReceipt: RETRY_RECEIPT,
      createdAt: '2026-08-10T16:00:00.000Z',
      executionStatusId: 'finalized',
    },
    summary: { queued: 1, skipped: 0, runtimeFinal: 1 },
    records: [
      {
        classificationId: 41,
        executionStatusId: 'queued',
        reconciliationStatusId,
      },
    ],
  }
}

function mountMaintenance() {
  let maintenance
  const TestComponent = defineComponent({
    setup() {
      maintenance = useHistoricRouteSafetyRefreshMaintenance()
      return maintenance
    },
    template: '<div />',
  })

  const wrapper = mount(TestComponent)
  return { maintenance, wrapper }
}

function setDocumentVisibility(visibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: visibilityState,
  })
}

describe('useHistoricRouteSafetyRefreshMaintenance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setDocumentVisibility('visible')
    apiMock.getHistoricRouteSafetyRefreshInventory.mockResolvedValue(inventoryReport)
  })

  afterEach(() => {
    vi.useRealTimers()
    setDocumentVisibility('visible')
  })

  it('loads only a validated read-only inventory and enforces the server selection cap', async () => {
    const { maintenance, wrapper } = mountMaintenance()

    await expect(maintenance.loadInventory({ reset: true })).resolves.toEqual(inventoryReport)
    expect(apiMock.getHistoricRouteSafetyRefreshInventory).toHaveBeenCalledWith({ limit: 25 })

    maintenance.toggleSelection(41)
    maintenance.toggleSelection(42)
    maintenance.toggleSelection(43)

    expect(maintenance.selectedClassificationIds.value).toEqual([41, 42])
    expect(maintenance.selectionMessage.value).toBe('Select at most 2 records for one controlled retry.')

    wrapper.unmount()
  })

  it('rejects an inventory that is not the protected read-only contract', async () => {
    apiMock.getHistoricRouteSafetyRefreshInventory.mockResolvedValue({ mode: 'mutation', records: [] })
    const { maintenance, wrapper } = mountMaintenance()

    await expect(maintenance.loadInventory({ reset: true })).resolves.toBeNull()

    expect(maintenance.inventory.value).toBeNull()
    expect(maintenance.inventoryError.value).toBe('Unable to load the historic route-safety inventory.')

    wrapper.unmount()
  })

  it('sends only an explicit selected ID list and immediately reads its receipt', async () => {
    apiMock.executeHistoricRouteSafetyRefresh.mockResolvedValue({
      data: { retryReceipt: RETRY_RECEIPT },
    })
    apiMock.getHistoricRouteSafetyRefreshReceipt.mockResolvedValue(receiptReport())
    const { maintenance, wrapper } = mountMaintenance()

    await maintenance.loadInventory({ reset: true })
    maintenance.toggleSelection(41)

    await expect(maintenance.executeSelected()).resolves.toEqual({ retryReceipt: RETRY_RECEIPT })

    expect(apiMock.executeHistoricRouteSafetyRefresh).toHaveBeenCalledWith([41])
    expect(apiMock.getHistoricRouteSafetyRefreshReceipt).toHaveBeenCalledWith(RETRY_RECEIPT)
    expect(maintenance.selectedClassificationIds.value).toEqual([])
    expect(maintenance.receipt.value?.records).toHaveLength(1)
    expect(maintenance.actionMessage.value).toContain('Controlled retry accepted')

    wrapper.unmount()
  })

  it('does not poll while hidden and refreshes an in-flight receipt when the tab becomes visible', async () => {
    vi.useFakeTimers()
    apiMock.executeHistoricRouteSafetyRefresh.mockResolvedValue({
      data: { retryReceipt: RETRY_RECEIPT },
    })
    apiMock.getHistoricRouteSafetyRefreshReceipt
      .mockResolvedValueOnce(receiptReport('queue_processing'))
      .mockResolvedValueOnce(receiptReport('runtime_completed'))
    const { maintenance, wrapper } = mountMaintenance()

    await maintenance.loadInventory({ reset: true })
    maintenance.toggleSelection(41)
    await maintenance.executeSelected()
    expect(apiMock.getHistoricRouteSafetyRefreshReceipt).toHaveBeenCalledTimes(1)

    setDocumentVisibility('hidden')
    await vi.advanceTimersByTimeAsync(5000)
    expect(apiMock.getHistoricRouteSafetyRefreshReceipt).toHaveBeenCalledTimes(1)

    setDocumentVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()

    expect(apiMock.getHistoricRouteSafetyRefreshReceipt).toHaveBeenCalledTimes(2)
    expect(maintenance.isReceiptInFlight.value).toBe(false)

    wrapper.unmount()
  })
})
