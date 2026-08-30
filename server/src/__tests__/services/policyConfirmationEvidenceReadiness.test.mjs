/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildPolicyConfirmationEvidenceReadiness,
} from '../../services/policyConfirmationEvidenceReadiness.mjs';

describe('policyConfirmationEvidenceReadiness', () => {
  test('fails closed until a representative confirmation cohort is available', () => {
    const report = buildPolicyConfirmationEvidenceReadiness({
      confirmationEvidenceObservationCount: 19,
      specializedDeclaredEvidenceCount: 0,
      compatibilityOnlyEvidenceCount: 3,
      profileEvidenceCount: 99,
      calibrationAppliedCount: -1,
    });

    expect(report).toEqual(expect.objectContaining({
      version: 'current_library.policy_confirmation_evidence_readiness.v1',
      statusId: 'insufficient_data',
      confirmationObservationCount: 19,
      minimumObservationCount: 20,
      declaredScope: expect.objectContaining({
        specializedEvidenceCount: 0,
        compatibilityOnlyEvidenceCount: 3,
        noDeclaredEvidenceCount: 16,
      }),
      calibration: { appliedCount: 0, appliedRatePercent: 0 },
    }));
    expect(report.supportingEvidenceSources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'observed_profile', count: 19, ratePercent: 100 }),
    ]));
  });

  test('recommends declared-scope review only for a sufficient weak-scope cohort', () => {
    const report = buildPolicyConfirmationEvidenceReadiness({
      confirmationEvidenceObservationCount: 20,
      specializedDeclaredEvidenceCount: 11,
      compatibilityOnlyEvidenceCount: 5,
      profileEvidenceCount: 8,
      patternEvidenceCount: 3,
      ragEvidenceCount: 7,
      historyEvidenceCount: 2,
      calibrationAppliedCount: 9,
    });

    expect(report).toMatchObject({
      statusId: 'declared_scope_review_recommended',
      declaredScope: {
        specializedEvidenceCount: 11,
        specializedEvidenceRatePercent: 55,
        compatibilityOnlyEvidenceCount: 5,
        noDeclaredEvidenceCount: 4,
        minimumSpecializedEvidenceRatePercent: 60,
      },
      calibration: { appliedCount: 9, appliedRatePercent: 45 },
    });
    expect(report.supportingEvidenceSources).toEqual([
      { id: 'observed_profile', count: 8, ratePercent: 40 },
      { id: 'confirmed_pattern', count: 3, ratePercent: 15 },
      { id: 'similar_items', count: 7, ratePercent: 35 },
      { id: 'prior_outcomes', count: 2, ratePercent: 10 },
    ]);
  });

  test('does not recommend scope maintenance at the specialized-evidence threshold', () => {
    const report = buildPolicyConfirmationEvidenceReadiness({
      confirmationEvidenceObservationCount: 20,
      specializedDeclaredEvidenceCount: 12,
      compatibilityOnlyEvidenceCount: 4,
    });

    expect(report.statusId).toBe('evidence_mix_observed');
    expect(report.declaredScope).toMatchObject({
      specializedEvidenceRatePercent: 60,
      noDeclaredEvidenceCount: 4,
    });
  });
});
