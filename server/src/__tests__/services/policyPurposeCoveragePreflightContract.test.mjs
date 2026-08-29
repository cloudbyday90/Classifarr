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
  POLICY_INTENT_DRAFT_BUCKETS,
  POLICY_INTENT_DRAFT_REQUEST_SCHEMA_VERSION,
} from '../../services/policyIntentRequestValidator.mjs';
import {
  buildPolicyPurposeCoveragePreflight,
  buildPolicyPurposeCoveragePreflightCandidate,
} from '../../services/policyPurposeCoveragePreflightContract.mjs';

function validDraft(overrides = {}) {
  return {
    schema_version: POLICY_INTENT_DRAFT_REQUEST_SCHEMA_VERSION,
    source: 'legacy_policy_builder',
    migration_state: 'legacy_compatible',
    presets: [{
      preset_id: 17,
      preset_name: 'Family',
      weight: 1,
      source: 'legacy_preset',
      migration_state: 'legacy_compatible',
      buckets: {
        [POLICY_INTENT_DRAFT_BUCKETS.IDENTITY]: [{
          bucket: POLICY_INTENT_DRAFT_BUCKETS.IDENTITY,
          signal_type: 'genres',
          values: { require_any: ['family-preflight-token', 'FAMILY-PREFLIGHT-TOKEN'] },
          metadata: { semantics: 'identity' },
          source: 'legacy_preset',
        }, {
          bucket: POLICY_INTENT_DRAFT_BUCKETS.IDENTITY,
          signal_type: 'keywords',
          values: { require_all: ['Coming Of Age'] },
          metadata: { semantics: 'identity' },
          source: 'legacy_preset',
        }],
        [POLICY_INTENT_DRAFT_BUCKETS.COMPATIBILITY]: [{
          bucket: POLICY_INTENT_DRAFT_BUCKETS.COMPATIBILITY,
          signal_type: 'studios',
          values: { require_any: ['Ignored Compatibility Studio'] },
          metadata: { semantics: 'compatibility' },
          source: 'legacy_preset',
        }],
        [POLICY_INTENT_DRAFT_BUCKETS.STRICT_CONSTRAINTS]: [],
        [POLICY_INTENT_DRAFT_BUCKETS.BOOSTERS]: [],
        [POLICY_INTENT_DRAFT_BUCKETS.EXCLUSIONS]: [],
        [POLICY_INTENT_DRAFT_BUCKETS.REVIEW_TRIGGERS]: [],
      },
      warnings: [],
    }],
    summary: { preset_count: 1 },
    ...overrides,
  };
}

describe('policyPurposeCoveragePreflightContract', () => {
  test('derives only normalized required purpose terms from a validated transient draft', () => {
    const candidate = buildPolicyPurposeCoveragePreflightCandidate(validDraft());

    expect(candidate).toEqual({
      requiredSignalTypeCount: 2,
      requiredTermCount: 2,
      terms: expect.arrayContaining([
        {
          signalType: 'genres',
          operator: 'require_any',
          termKey: 'family-preflight-token',
        },
        {
          signalType: 'keywords',
          operator: 'require_all',
          termKey: 'coming of age',
        },
      ]),
    });
    expect(candidate.terms).not.toContainEqual(
      expect.objectContaining({ termKey: 'ignored compatibility studio' }),
    );
  });

  test('returns bounded aggregate coverage and fixed guidance without retaining draft terms', () => {
    const preflight = buildPolicyPurposeCoveragePreflight({
      context: {
        policy_id: 17,
        policy_name: 'Family Policy',
        library_id: 18,
        library_name: 'Family Movies',
        library_media_type: 'movie',
      },
      candidate: buildPolicyPurposeCoveragePreflightCandidate(validDraft()),
      overlap: {
        shared_required_term_count: 2,
        overlapping_destination_count: 1,
        shared_require_any_term_count: 1,
        shared_require_any_destination_count: 1,
      },
      evaluatedAt: '2026-08-16T12:00:00.000Z',
    });

    expect(preflight).toEqual(expect.objectContaining({
      version: 'policy_purpose_coverage_preflight.v2',
      advisory: true,
      draftRetained: false,
      rawConfigurationExposed: false,
      routingAffected: false,
      providerAccessed: false,
      databaseWritten: false,
      coverage: expect.objectContaining({
        statusId: 'broad_overlap_review_required',
        requiredSignalTypeCount: 2,
        requiredTermCount: 2,
        uniqueRequiredTermCount: 0,
        sharedRequireAnyTermCount: 1,
        sharedRequireAnyDestinationCount: 1,
      }),
    }));
    expect(JSON.stringify(preflight)).not.toContain('Coming Of Age');
    expect(JSON.stringify(preflight)).not.toContain('family-preflight-token');
    expect(JSON.stringify(preflight)).not.toContain('Ignored Compatibility Studio');
  });
});
