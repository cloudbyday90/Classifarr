/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { buildPolicyIntentReplayTmdbMetadataCoverageComparison } from '../services/policyIntentReplayTmdbMetadataCoverageComparison.mjs';

describe('policyIntentReplayTmdbMetadataCoverageComparison', () => {
  test('summarizes before and after field coverage without provider values', () => {
    const comparison = buildPolicyIntentReplayTmdbMetadataCoverageComparison({
      evidenceCompleteness: {
        items: [{
          sample_id: 1,
          completeness: 'partial',
          available_fields: ['genres', 'language'],
          missing_fields: ['rating', 'keywords', 'studio', 'overview', 'runtime', 'vote_average'],
        }],
      },
      tmdbMetadataAdapterPreview: {
        status: 'ready',
        items: [{
          sample_id: 1,
          status: 'ready',
          improved_fields: ['rating', 'keywords', 'studio'],
          raw_provider_payload: { title: 'Mulan' },
        }],
      },
    });

    expect(comparison).toEqual(expect.objectContaining({
      schema_version: 1,
      mode: 'replay_tmdb_metadata_coverage_comparison',
      enabled: true,
      status: 'improved',
      sample_count: 1,
      comparable_count: 1,
      improved_sample_count: 1,
      upgraded_completeness_count: 1,
      added_field_count: 3,
      remaining_missing_field_count: 3,
      before_strong_count: 0,
      after_strong_count: 1,
    }));
    expect(comparison.items[0]).toEqual({
      sample_id: 1,
      status: 'improved',
      before_completeness: 'partial',
      after_completeness: 'strong',
      before_available_fields: ['genres', 'language'],
      added_fields: ['rating', 'keywords', 'studio'],
      after_available_fields: ['rating', 'genres', 'keywords', 'studio', 'language'],
      remaining_missing_fields: ['overview', 'runtime', 'vote_average'],
      reason_codes: [
        'tmdb_preview:ready',
        'coverage:would_add_fields',
        'coverage:completeness_partial_to_strong',
      ],
    });
    expect(JSON.stringify(comparison)).not.toContain('Mulan');
  });

  test('reports blocked adapter coverage without implying improvement', () => {
    const comparison = buildPolicyIntentReplayTmdbMetadataCoverageComparison({
      evidenceCompleteness: {
        items: [{
          sample_id: 1,
          available_fields: ['rating'],
          missing_fields: ['genres'],
        }],
      },
      tmdbMetadataAdapterPreview: {
        status: 'blocked',
        items: [],
      },
    });

    expect(comparison).toEqual(expect.objectContaining({
      status: 'blocked',
      sample_count: 1,
      comparable_count: 0,
      improved_sample_count: 0,
      added_field_count: 0,
    }));
    expect(comparison.items[0]).toEqual(expect.objectContaining({
      status: 'not_previewed',
      before_completeness: 'partial',
      after_completeness: 'partial',
      added_fields: [],
      remaining_missing_fields: ['genres'],
    }));
  });
});
