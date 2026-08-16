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
    preflightPolicyPurposeCoverage: vi.fn(),
  },
}))

vi.mock('@/api', () => ({ default: apiMock }))

import { usePolicyPurposeCoveragePreflight } from '@/composables/usePolicyPurposeCoveragePreflight'

describe('usePolicyPurposeCoveragePreflight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requests one explicit server-owned preflight and unwraps its aggregate response', async () => {
    const response = { advisory: true, draftRetained: false }
    apiMock.preflightPolicyPurposeCoverage.mockResolvedValue({ data: response })
    const preflight = usePolicyPurposeCoveragePreflight()

    await expect(preflight.runPreflight({ policyId: 17, draft: { presets: [] } }))
      .resolves.toEqual(response)

    expect(apiMock.preflightPolicyPurposeCoverage).toHaveBeenCalledWith(17, { presets: [] })
    expect(preflight.preflight.value).toEqual(response)
    expect(preflight.isLoading.value).toBe(false)
  })

  it('keeps failures bounded and clears stale results before retrying', async () => {
    apiMock.preflightPolicyPurposeCoverage
      .mockResolvedValueOnce({ data: { advisory: true } })
      .mockRejectedValueOnce({ response: { data: { message: 'Admin access required' } } })
    const preflight = usePolicyPurposeCoveragePreflight()

    await preflight.runPreflight({ policyId: 17, draft: {} })
    await expect(preflight.runPreflight({ policyId: 17, draft: {} })).resolves.toBeNull()

    expect(preflight.preflight.value).toBeNull()
    expect(preflight.errorMessage.value).toBe('Admin access required')

    preflight.reset()
    expect(preflight.errorMessage.value).toBe('')
  })
})
