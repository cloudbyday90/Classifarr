/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getNativeIntentConversionPreview: vi.fn(),
    applyNativeIntentConversion: vi.fn(),
  },
}))

vi.mock('@/api', () => ({ default: apiMock }))

import { usePolicyNativeIntentConversionMaintenance } from '@/composables/usePolicyNativeIntentConversionMaintenance'

const preview = {
  candidateReport: {
    candidates: [
      {
        policyId: 11,
        policyName: 'Ready policy',
        canConvert: true,
      },
      {
        policyId: 12,
        policyName: 'Review policy',
        canConvert: false,
      },
    ],
    summary: {
      totalPolicyCount: 2,
      convertibleCount: 1,
      reviewRequiredCount: 1,
    },
  },
}

describe('usePolicyNativeIntentConversionMaintenance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts only current ready candidates into the selection', async () => {
    apiMock.getNativeIntentConversionPreview.mockResolvedValue(preview)
    const maintenance = usePolicyNativeIntentConversionMaintenance()

    await maintenance.loadPreview()
    maintenance.selectPolicy(11, true)
    maintenance.selectPolicy(12, true)

    expect(maintenance.selectedCount.value).toBe(1)
    expect(maintenance.selectedCandidates.value).toEqual([preview.candidateReport.candidates[0]])
  })

  it('keeps a conversion batch bounded to twenty-five ready policies', async () => {
    const candidates = Array.from({ length: 26 }, (_, index) => ({
      policyId: index + 1,
      canConvert: true,
    }))
    apiMock.getNativeIntentConversionPreview.mockResolvedValue({
      candidateReport: { candidates, summary: {} },
    })
    const maintenance = usePolicyNativeIntentConversionMaintenance()

    await maintenance.loadPreview()
    candidates.forEach(candidate => maintenance.selectPolicy(candidate.policyId, true))

    expect(maintenance.selectedCount.value).toBe(25)
    expect(maintenance.isSelected(26)).toBe(false)
  })

  it('requires the exact confirmation and refreshes preview after a successful apply', async () => {
    apiMock.getNativeIntentConversionPreview.mockResolvedValue(preview)
    apiMock.applyNativeIntentConversion.mockResolvedValue({
      data: {
        summary: {
          appliedPolicyCount: 1,
          alreadyConvertedCount: 0,
        },
        runtimeObservation: {
          statusId: 'verified',
          summary: {
            observedPolicyCount: 1,
            nativeReadVerifiedCount: 1,
            rollbackAvailableCount: 1,
          },
        },
      },
    })
    const maintenance = usePolicyNativeIntentConversionMaintenance()

    await maintenance.loadPreview()
    maintenance.selectPolicy(11, true)

    await expect(maintenance.applySelectedPolicies('wrong')).resolves.toEqual({
      applied: false,
      reason: 'confirmation_invalid',
    })
    expect(apiMock.applyNativeIntentConversion).not.toHaveBeenCalled()

    await expect(maintenance.applySelectedPolicies('CONVERT_NATIVE_INTENT')).resolves.toMatchObject({
      applied: true,
    })
    expect(apiMock.applyNativeIntentConversion).toHaveBeenCalledWith({
      policy_ids: [11],
      confirmation: 'CONVERT_NATIVE_INTENT',
    })
    expect(apiMock.getNativeIntentConversionPreview).toHaveBeenCalledTimes(2)
    expect(maintenance.selectedCount.value).toBe(0)
    expect(maintenance.successMessage.value).toBe('1 policy was converted to native intent.')
    expect(maintenance.runtimeObservation.value).toEqual(expect.objectContaining({
      statusId: 'verified',
      summary: expect.objectContaining({
        nativeReadVerifiedCount: 1,
      }),
    }))
  })

  it('shows a bounded error message when the current preview cannot load', async () => {
    apiMock.getNativeIntentConversionPreview.mockRejectedValue({
      response: { data: { message: 'Admin access required' } },
    })
    const maintenance = usePolicyNativeIntentConversionMaintenance()

    await maintenance.loadPreview()

    expect(maintenance.errorMessage.value).toBe('Admin access required')
  })
})
