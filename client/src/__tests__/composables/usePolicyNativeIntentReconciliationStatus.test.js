/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getNativeIntentReconciliationStatus: vi.fn(),
  },
}))

vi.mock('@/api', () => ({ default: apiMock }))

import { usePolicyNativeIntentReconciliationStatus } from '@/composables/usePolicyNativeIntentReconciliationStatus'

describe('usePolicyNativeIntentReconciliationStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the bounded, read-only scheduler status without a mutation action', async () => {
    const response = {
      statusId: 'attention_required',
      inventory: { unresolvedCount: 2 },
    }
    apiMock.getNativeIntentReconciliationStatus.mockResolvedValue(response)
    const reconciliation = usePolicyNativeIntentReconciliationStatus()

    await expect(reconciliation.loadStatus()).resolves.toEqual(response)

    expect(apiMock.getNativeIntentReconciliationStatus).toHaveBeenCalledOnce()
    expect(reconciliation.status.value).toEqual(response)
    expect(reconciliation.errorMessage.value).toBe('')
  })

  it('keeps the failure message bounded when the status endpoint rejects', async () => {
    apiMock.getNativeIntentReconciliationStatus.mockRejectedValue({
      response: { data: { message: 'Admin access required' } },
    })
    const reconciliation = usePolicyNativeIntentReconciliationStatus()

    await expect(reconciliation.loadStatus()).resolves.toBeNull()

    expect(reconciliation.errorMessage.value).toBe('Admin access required')
  })
})
