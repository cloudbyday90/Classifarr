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
  POLICY_PURPOSE_HEALTH_STATUS_IDS,
  buildPolicyPurposeHealthSummary,
} from '../../services/policyPurposeHealthContract.mjs';

describe('policyPurposeHealthContract', () => {
  test('reduces bounded policy records to library-level, non-identifying health counts', () => {
    const summary = buildPolicyPurposeHealthSummary({
      records: [{
        library_id: 11,
        policy_name: 'Never exposed',
        required_term_count: 2,
        shared_required_term_count: 0,
        specialized_purpose_rule_count: 2,
        declared_native_purpose_rule_count: 2,
        values: { require_all: ['private value'] },
      }, {
        library_id: 12,
        required_term_count: 0,
        specialized_purpose_rule_count: 2,
        inferred_profile_purpose_rule_count: 2,
      }, {
        library_id: 13,
        required_term_count: 2,
        shared_required_term_count: 2,
        overlapping_destination_count: 1,
        specialized_purpose_rule_count: 1,
        declared_native_purpose_rule_count: 1,
      }, {
        // A second active policy for library 11 cannot inflate the summary.
        library_id: 11,
        required_term_count: 2,
        specialized_purpose_rule_count: 1,
        declared_native_purpose_rule_count: 1,
      }],
    });

    expect(summary).toEqual({
      version: 'policy_purpose_health.v2',
      statusId: POLICY_PURPOSE_HEALTH_STATUS_IDS.ATTENTION_REQUIRED,
      summary: {
        reviewedLibraryCount: 3,
        declaredPurposeLibraryCount: 2,
        missingPurposeLibraryCount: 1,
        competingDestinationLibraryCount: 1,
        profileDerivedPurposeLibraryCount: 1,
        unverifiedPurposeLibraryCount: 0,
        needsAttentionLibraryCount: 2,
        reviewWindowTruncated: false,
      },
      outcomeQuality: {
        version: 'policy_purpose_outcome_quality.v1',
        statusId: 'awaiting_confirmed_outcomes',
        summary: {
          reviewedLibraryCount: 3,
          eligibleDeclaredPurposeLibraryCount: 1,
          confirmedOutcomeLibraryCount: 0,
          outcomeCorroboratedLibraryCount: 0,
          outcomeReviewRequiredLibraryCount: 0,
          awaitingConfirmedOutcomeLibraryCount: 1,
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
      },
      rawPurposeRulesExposed: false,
      libraryIdentityExposed: false,
      policyIdentityExposed: false,
      observedOutcomeDataExposed: false,
      semanticSelectionAffected: false,
      routingAffected: false,
    });
    expect(JSON.stringify(summary)).not.toContain('Never exposed');
    expect(JSON.stringify(summary)).not.toContain('private value');
  });

  test('marks a bounded response as incomplete without promoting its status to ready', () => {
    const summary = buildPolicyPurposeHealthSummary({
      truncated: true,
      records: [{
        library_id: 11,
        required_term_count: 2,
        specialized_purpose_rule_count: 2,
        declared_native_purpose_rule_count: 2,
      }],
    });

    expect(summary.statusId).toBe(POLICY_PURPOSE_HEALTH_STATUS_IDS.REVIEW_WINDOW_TRUNCATED);
    expect(summary.summary).toEqual(expect.objectContaining({
      reviewedLibraryCount: 1,
      needsAttentionLibraryCount: 0,
      reviewWindowTruncated: true,
    }));
  });

  test('reports that there is nothing to assess when no valid active record is present', () => {
    const summary = buildPolicyPurposeHealthSummary({ records: [{ library_id: 0 }] });

    expect(summary.statusId).toBe(POLICY_PURPOSE_HEALTH_STATUS_IDS.NO_ACTIVE_VALIDATED_NATIVE_POLICY);
    expect(summary.summary).toEqual(expect.objectContaining({
      reviewedLibraryCount: 0,
      needsAttentionLibraryCount: 0,
    }));
  });
});
