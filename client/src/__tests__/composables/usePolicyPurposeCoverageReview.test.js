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
    getPolicyPurposeCoverageReview: vi.fn(),
  },
}))

vi.mock('@/api', () => ({ default: apiMock }))

import { usePolicyPurposeCoverageReview } from '@/composables/usePolicyPurposeCoverageReview'

describe('usePolicyPurposeCoverageReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the administrator-owned read-only coverage review', async () => {
    const response = { entries: [], rawConfigurationExposed: false }
    apiMock.getPolicyPurposeCoverageReview.mockResolvedValue(response)
    const coverageReview = usePolicyPurposeCoverageReview()

    await expect(coverageReview.loadReview()).resolves.toEqual(response)

    expect(apiMock.getPolicyPurposeCoverageReview).toHaveBeenCalledOnce()
    expect(coverageReview.review.value).toEqual(response)
  })

  it('keeps authorization failures bounded', async () => {
    apiMock.getPolicyPurposeCoverageReview.mockRejectedValue({
      response: { data: { message: 'Admin access required' } },
    })
    const coverageReview = usePolicyPurposeCoverageReview()

    await expect(coverageReview.loadReview()).resolves.toBeNull()

    expect(coverageReview.errorMessage.value).toBe('Admin access required')
  })
})
