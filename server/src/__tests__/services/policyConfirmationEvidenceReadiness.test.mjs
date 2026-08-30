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
      version: 'current_library.policy_confirmation_evidence_readiness.v2',
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

  test('keeps a borderline weak-scope cohort inconclusive when its interval overlaps the threshold', () => {
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
      statusId: 'evidence_mix_inconclusive',
      declaredScope: {
        specializedEvidenceCount: 11,
        specializedEvidenceRatePercent: 55,
        compatibilityOnlyEvidenceCount: 5,
        noDeclaredEvidenceCount: 4,
        minimumSpecializedEvidenceRatePercent: 60,
        specializedEvidenceConfidenceInterval: {
          methodId: 'wilson_score',
          confidenceLevelPercent: 95,
          lowerRatePercent: 34.2,
          upperRatePercent: 74.2,
        },
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

  test('recommends scope maintenance only when the confidence interval is entirely below the threshold', () => {
    const report = buildPolicyConfirmationEvidenceReadiness({
      confirmationEvidenceObservationCount: 20,
      specializedDeclaredEvidenceCount: 2,
      compatibilityOnlyEvidenceCount: 12,
    });

    expect(report.statusId).toBe('declared_scope_review_recommended');
    expect(report.declaredScope).toMatchObject({
      specializedEvidenceRatePercent: 10,
      noDeclaredEvidenceCount: 6,
      specializedEvidenceConfidenceInterval: {
        lowerRatePercent: 2.8,
        upperRatePercent: 30.1,
      },
    });
  });

  test('reports sufficiently represented evidence only when the interval reaches the threshold', () => {
    const report = buildPolicyConfirmationEvidenceReadiness({
      confirmationEvidenceObservationCount: 20,
      specializedDeclaredEvidenceCount: 20,
    });

    expect(report.statusId).toBe('evidence_mix_observed');
    expect(report.declaredScope.specializedEvidenceConfidenceInterval).toMatchObject({
      lowerRatePercent: 83.9,
      upperRatePercent: 100,
    });
  });
});
