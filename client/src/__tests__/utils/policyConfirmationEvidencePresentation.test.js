/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  formatPolicyConfirmationEvidenceConfidenceInterval,
  getPolicyConfirmationEvidenceStatusPresentation,
} from '@/utils/policyConfirmationEvidencePresentation'

describe('policyConfirmationEvidencePresentation', () => {
  it('presents the fixed inconclusive status without granting a maintenance action', () => {
    expect(getPolicyConfirmationEvidenceStatusPresentation('evidence_mix_inconclusive')).toEqual({
      label: 'Policy confirmation evidence is not yet conclusive',
      message: expect.stringContaining('overlaps that threshold'),
      className: 'border-blue-700/60 bg-blue-950/20',
    })
  })

  it('formats only the fixed Wilson confidence contract', () => {
    expect(formatPolicyConfirmationEvidenceConfidenceInterval({
      methodId: 'wilson_score',
      confidenceLevelPercent: 95,
      lowerRatePercent: 34.2,
      upperRatePercent: 74.2,
    })).toBe('95% Wilson interval: 34.2%–74.2%')
    expect(formatPolicyConfirmationEvidenceConfidenceInterval({
      methodId: 'provider_supplied_method',
      confidenceLevelPercent: 95,
      lowerRatePercent: 0,
      upperRatePercent: 100,
    })).toBe('Unavailable')
  })

  it('fails closed to fixed unavailable copy for an unknown status', () => {
    expect(getPolicyConfirmationEvidenceStatusPresentation('provider_supplied_status')).toEqual({
      label: 'Policy confirmation evidence is unavailable',
      message: 'Policy confirmation evidence monitoring is currently unavailable.',
      className: 'border-gray-700 bg-gray-800',
    })
  })
})
