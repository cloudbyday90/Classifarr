/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_PURPOSE_OUTCOME_QUALITY_STATUS_IDS,
  buildPolicyPurposeOutcomeQualitySummary,
} from '../../services/policyPurposeOutcomeQualityContract.mjs';

function declaredDistinctRecord(libraryId) {
  return {
    library_id: libraryId,
    required_term_count: 2,
    shared_required_term_count: 0,
    specialized_purpose_rule_count: 2,
    declared_native_purpose_rule_count: 2,
  };
}

describe('policyPurposeOutcomeQualityContract', () => {
  test('reports aggregate corroboration and a bounded review priority without exposing terms or outcomes', () => {
    const summary = buildPolicyPurposeOutcomeQualitySummary({
      records: [
        declaredDistinctRecord(11),
        declaredDistinctRecord(12),
        {
          library_id: 13,
          required_term_count: 0,
          specialized_purpose_rule_count: 0,
        },
      ],
      outcomeRecords: [
        {
          library_id: 11,
          confirmed_outcome_term_count: 2,
          declared_purpose_aligned_outcome_term_count: 1,
          evidence_key: 'genre:never-exposed',
        },
        {
          library_id: 12,
          confirmed_outcome_term_count: 1,
          declared_purpose_aligned_outcome_term_count: 0,
        },
      ],
    });

    expect(summary).toEqual(expect.objectContaining({
      version: 'policy_purpose_outcome_quality.v1',
      statusId: POLICY_PURPOSE_OUTCOME_QUALITY_STATUS_IDS.REVIEW_REQUIRED,
      summary: {
        reviewedLibraryCount: 3,
        eligibleDeclaredPurposeLibraryCount: 2,
        confirmedOutcomeLibraryCount: 2,
        outcomeCorroboratedLibraryCount: 1,
        outcomeReviewRequiredLibraryCount: 1,
        awaitingConfirmedOutcomeLibraryCount: 0,
        reviewWindowTruncated: false,
      },
      confirmedOperatorOutcomeEvidenceOnly: true,
      stableClassificationAnchorRequired: true,
      rawOutcomeEvidenceExposed: false,
      libraryIdentityExposed: false,
      policyIdentityExposed: false,
      semanticSelectionAffected: false,
      policyChanged: false,
      aiRagTuningAffected: false,
      routingAffected: false,
      learningAffected: false,
    }));
    expect(JSON.stringify(summary)).not.toContain('never-exposed');
  });

  test('fails closed when the aggregate evidence read is unavailable', () => {
    const summary = buildPolicyPurposeOutcomeQualitySummary({
      records: [declaredDistinctRecord(11)],
      readAvailable: false,
    });

    expect(summary.statusId).toBe(POLICY_PURPOSE_OUTCOME_QUALITY_STATUS_IDS.READ_UNAVAILABLE);
    expect(summary.routingAffected).toBe(false);
    expect(summary.learningAffected).toBe(false);
  });

  test('does not claim a quality result when another active policy for the library needs structural review', () => {
    const summary = buildPolicyPurposeOutcomeQualitySummary({
      records: [
        declaredDistinctRecord(11),
        {
          library_id: 11,
          required_term_count: 0,
          specialized_purpose_rule_count: 0,
        },
      ],
      outcomeRecords: [{
        library_id: 11,
        confirmed_outcome_term_count: 2,
        declared_purpose_aligned_outcome_term_count: 2,
      }],
    });

    expect(summary.statusId).toBe(
      POLICY_PURPOSE_OUTCOME_QUALITY_STATUS_IDS.NO_DECLARED_DISTINCT_PURPOSE,
    );
    expect(summary.summary.eligibleDeclaredPurposeLibraryCount).toBe(0);
  });
});
