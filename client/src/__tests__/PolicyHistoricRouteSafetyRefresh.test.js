/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    executeHistoricRouteSafetyRefresh: vi.fn(),
    getHistoricRouteSafetyRefreshInventory: vi.fn(),
    getHistoricRouteSafetyRefreshReceipt: vi.fn(),
    getHistoricRouteSafetyRefreshRecentReceipt: vi.fn(),
  },
}))

vi.mock('@/api', () => ({ default: apiMock }))

import PolicyHistoricRouteSafetyRefresh from '@/views/PolicyHistoricRouteSafetyRefresh.vue'

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
  ],
  pagination: { cursor: null, nextCursor: null, hasNextPage: false },
  operatorRetryPlan: { maximumClassificationIds: 50 },
}

const receiptReport = {
  mode: 'read_only',
  receipt: {
    retryReceipt: RETRY_RECEIPT,
    createdAt: '2026-08-10T16:00:00.000Z',
    executionStatusId: 'finalized',
    retryTaskId: 991,
  },
  summary: { queued: 1, skipped: 0, runtimeFinal: 1 },
  records: [
    {
      classificationId: 41,
      executionStatusId: 'queued',
      executionReasonId: 'internal_reason',
      reconciliationStatusId: 'runtime_completed',
      rawHistoryMetadata: 'do-not-render',
    },
  ],
}

function mountView() {
  return mount(PolicyHistoricRouteSafetyRefresh, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  })
}

describe('PolicyHistoricRouteSafetyRefresh.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getHistoricRouteSafetyRefreshInventory.mockResolvedValue(inventoryReport)
    apiMock.getHistoricRouteSafetyRefreshRecentReceipt.mockResolvedValue({ mode: 'read_only', recentReceipt: null })
  })

  it('requires an explicit selection and acknowledgement before it starts a controlled retry', async () => {
    apiMock.executeHistoricRouteSafetyRefresh.mockResolvedValue({
      data: { retryReceipt: RETRY_RECEIPT },
    })
    apiMock.getHistoricRouteSafetyRefreshReceipt.mockResolvedValue(receiptReport)
    const wrapper = mountView()
    await flushPromises()

    const retryButton = wrapper.findAll('button').find(button => button.text().startsWith('Retry 0 selected'))
    expect(retryButton?.attributes('disabled')).toBeDefined()
    expect(wrapper.find('#historic-route-safety-select-41').element.checked).toBe(false)

    await wrapper.find('#historic-route-safety-select-41').setValue(true)
    const selectedRetryButton = wrapper.findAll('button').find(button => button.text().startsWith('Retry 1 selected'))
    expect(selectedRetryButton?.attributes('disabled')).toBeDefined()

    await wrapper.find('#historic-route-safety-execution-acknowledgement').setValue(true)
    expect(selectedRetryButton?.attributes('disabled')).toBeUndefined()

    await selectedRetryButton?.trigger('click')
    await flushPromises()

    expect(apiMock.executeHistoricRouteSafetyRefresh).toHaveBeenCalledWith([41])
    expect(apiMock.getHistoricRouteSafetyRefreshReceipt).toHaveBeenCalledWith(RETRY_RECEIPT)
    expect(wrapper.text()).toContain('Protected receipt')
    expect(wrapper.text()).toContain('Completed')
    expect(wrapper.text()).not.toContain('991')
    expect(wrapper.text()).not.toContain('internal_reason')
    expect(wrapper.text()).not.toContain('do-not-render')

    wrapper.unmount()
  })

  it('shows a bounded administrator error rather than a server-provided detail', async () => {
    apiMock.executeHistoricRouteSafetyRefresh.mockRejectedValue({
      response: {
        status: 403,
        data: { message: 'secret authorization implementation detail' },
      },
    })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('#historic-route-safety-select-41').setValue(true)
    await wrapper.find('#historic-route-safety-execution-acknowledgement').setValue(true)
    const retryButton = wrapper.findAll('button').find(button => button.text().startsWith('Retry 1 selected'))
    await retryButton?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Administrator authorization is required for this maintenance action.')
    expect(wrapper.text()).not.toContain('secret authorization implementation detail')

    wrapper.unmount()
  })
})
