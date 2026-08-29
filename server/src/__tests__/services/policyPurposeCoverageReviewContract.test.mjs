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
  POLICY_PURPOSE_COVERAGE_ACTION_IDS,
  POLICY_PURPOSE_COVERAGE_STATUS_IDS,
  buildPolicyPurposeCoverageReview,
  normalizePolicyPurposeCoverageReviewLimit,
} from '../../services/policyPurposeCoverageReviewContract.mjs';

describe('policyPurposeCoverageReviewContract', () => {
  test('presents only bounded counts and a fixed editor action for missing specialized coverage', () => {
    const review = buildPolicyPurposeCoverageReview({
      evaluatedAt: '2026-08-16T12:00:00.000Z',
      records: [{
        policy_id: 17,
        policy_name: 'General Movies Policy',
        library_id: 18,
        library_name: 'General Movies',
        library_media_type: 'movie',
        required_signal_type_count: 0,
        required_term_count: 0,
        shared_required_term_count: 0,
        overlapping_destination_count: 0,
        values: { require_any: ['must-not-leak'] },
      }],
    });

    expect(review).toEqual(expect.objectContaining({
      version: 'policy_purpose_coverage_review.v2',
      rawConfigurationExposed: false,
      routingAffected: false,
      summary: expect.objectContaining({
        reviewedPolicyCount: 1,
        missingCoverageCount: 1,
        broadOverlapCount: 0,
      }),
    }));
    expect(review.entries[0]).toEqual(expect.objectContaining({
      coverage: expect.objectContaining({
        statusId: POLICY_PURPOSE_COVERAGE_STATUS_IDS.MISSING_SPECIALIZED_COVERAGE,
        requiredTermCount: 0,
      }),
      action: expect.objectContaining({
        actionId: POLICY_PURPOSE_COVERAGE_ACTION_IDS.DECLARE_SPECIALIZED_PURPOSE,
        available: true,
        actionLabel: 'Review policy',
      }),
    }));
    expect(JSON.stringify(review)).not.toContain('must-not-leak');
  });

  test('requires review when a shared “any” alternative can satisfy an otherwise distinct policy', () => {
    const review = buildPolicyPurposeCoverageReview({
      records: [{
        policy_id: 17,
        policy_name: 'Broad Policy',
        library_id: 18,
        library_name: 'Broad Library',
        library_media_type: 'tv',
        required_signal_type_count: 2,
        required_term_count: 3,
        shared_required_term_count: 3,
        overlapping_destination_count: 2,
      }, {
        policy_id: 19,
        policy_name: 'Mixed Any Policy',
        library_id: 20,
        library_name: 'Mixed Any Library',
        library_media_type: 'tv',
        required_signal_type_count: 1,
        required_term_count: 3,
        shared_required_term_count: 2,
        overlapping_destination_count: 2,
        shared_require_any_term_count: 1,
        shared_require_any_destination_count: 1,
      }, {
        policy_id: 21,
        policy_name: 'Specific Policy',
        library_id: 22,
        library_name: 'Specific Library',
        library_media_type: 'tv',
        required_signal_type_count: 1,
        required_term_count: 3,
        shared_required_term_count: 2,
        overlapping_destination_count: 2,
      }],
    });

    expect(review.entries[0]).toEqual(expect.objectContaining({
      coverage: {
        statusId: POLICY_PURPOSE_COVERAGE_STATUS_IDS.BROAD_OVERLAP_REVIEW_REQUIRED,
        requiredSignalTypeCount: 2,
        requiredTermCount: 3,
        uniqueRequiredTermCount: 0,
        sharedRequiredTermCount: 3,
        overlappingDestinationCount: 2,
        sharedRequireAnyTermCount: 0,
        sharedRequireAnyDestinationCount: 0,
      },
      action: expect.objectContaining({
        actionId: POLICY_PURPOSE_COVERAGE_ACTION_IDS.REVIEW_BROAD_OVERLAP,
        available: true,
      }),
    }));
    expect(review.entries[1]).toEqual(expect.objectContaining({
      coverage: expect.objectContaining({
        statusId: POLICY_PURPOSE_COVERAGE_STATUS_IDS.BROAD_OVERLAP_REVIEW_REQUIRED,
        uniqueRequiredTermCount: 1,
        sharedRequireAnyTermCount: 1,
        sharedRequireAnyDestinationCount: 1,
      }),
      action: expect.objectContaining({
        actionId: POLICY_PURPOSE_COVERAGE_ACTION_IDS.REVIEW_BROAD_OVERLAP,
        available: true,
      }),
    }));
    expect(review.entries[2]).toEqual(expect.objectContaining({
      coverage: expect.objectContaining({
        statusId: POLICY_PURPOSE_COVERAGE_STATUS_IDS.DECLARED_SPECIALIZED_COVERAGE,
        uniqueRequiredTermCount: 1,
        sharedRequireAnyTermCount: 0,
      }),
      action: expect.objectContaining({
        actionId: POLICY_PURPOSE_COVERAGE_ACTION_IDS.NO_ACTION_REQUIRED,
        available: false,
      }),
    }));
  });

  test('bounds the report limit and retains a visible truncation signal', () => {
    expect(normalizePolicyPurposeCoverageReviewLimit()).toBe(50);
    expect(normalizePolicyPurposeCoverageReviewLimit('invalid')).toBe(50);
    expect(normalizePolicyPurposeCoverageReviewLimit(0)).toBe(50);
    expect(normalizePolicyPurposeCoverageReviewLimit(500)).toBe(100);

    const review = buildPolicyPurposeCoverageReview({
      limit: 500,
      truncated: true,
      records: [],
    });

    expect(review.summary).toEqual(expect.objectContaining({
      reportLimit: 100,
      truncated: true,
    }));
  });
});
