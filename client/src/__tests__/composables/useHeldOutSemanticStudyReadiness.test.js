/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getHeldOutSemanticStudyReadiness: vi.fn(),
  },
}))

vi.mock('@/api', () => ({ default: apiMock }))

import { useHeldOutSemanticStudyReadiness } from '@/composables/useHeldOutSemanticStudyReadiness'

describe('useHeldOutSemanticStudyReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the bounded aggregate report without creating study work', async () => {
    const response = { statusId: 'normal_lifecycle_receipt_required' }
    apiMock.getHeldOutSemanticStudyReadiness.mockResolvedValue(response)
    const readiness = useHeldOutSemanticStudyReadiness()

    await expect(readiness.loadReadiness()).resolves.toEqual(response)

    expect(apiMock.getHeldOutSemanticStudyReadiness).toHaveBeenCalledOnce()
    expect(readiness.readiness.value).toEqual(response)
    expect(readiness.errorMessage.value).toBe('')
  })

  it('retains the newer report when an older request settles later', async () => {
    let resolveFirstRequest
    apiMock.getHeldOutSemanticStudyReadiness
      .mockImplementationOnce(() => new Promise(resolve => {
        resolveFirstRequest = resolve
      }))
      .mockResolvedValueOnce({ statusId: 'eligibility_audit_available' })
    const readiness = useHeldOutSemanticStudyReadiness()

    const olderRead = readiness.loadReadiness()
    await expect(readiness.loadReadiness()).resolves.toEqual({
      statusId: 'eligibility_audit_available',
    })

    resolveFirstRequest({ statusId: 'normal_lifecycle_receipt_required' })
    await expect(olderRead).resolves.toBeNull()
    expect(readiness.readiness.value).toEqual({ statusId: 'eligibility_audit_available' })
  })
})
