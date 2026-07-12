/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildPolicyReplayPreviewMigrationVerifier,
  buildPolicyReplayPreviewMigrationSampleQuery,
  normalizePolicyReplayPreviewMigrationLimit,
  sanitizePolicyReplayPreviewMigrationSample,
} from '../services/policyReplayPreviewMigrationVerifier.mjs';

describe('policyReplayPreviewMigrationVerifier', () => {
  test('normalizes replay limits with defaults and caps', () => {
    expect(normalizePolicyReplayPreviewMigrationLimit(undefined)).toBe(10);
    expect(normalizePolicyReplayPreviewMigrationLimit('not-a-number')).toBe(10);
    expect(normalizePolicyReplayPreviewMigrationLimit(0)).toBe(1);
    expect(normalizePolicyReplayPreviewMigrationLimit(99)).toBe(25);
    expect(normalizePolicyReplayPreviewMigrationLimit('7')).toBe(7);
  });

  test('builds parameterized representative sample queries', () => {
    const query = buildPolicyReplayPreviewMigrationSampleQuery({
      libraryId: 12,
      mediaType: 'movie',
      limit: 3,
    });

    expect(query.text).toContain('FROM classification_history');
    expect(query.text).toContain('library_id = $1');
    expect(query.text).toContain('media_type = $2');
    expect(query.text).toContain('LIMIT $3');
    expect(query.values).toEqual([12, 'movie', 3]);
  });

  test('rejects a missing library id for replay samples', () => {
    expect(() => buildPolicyReplayPreviewMigrationSampleQuery({
      libraryId: null,
      mediaType: 'movie',
      limit: 3,
    })).toThrow('A valid library_id is required for replay migration verification');
  });

  test('sanitizes sample rows without raw metadata identifiers', () => {
    const sample = sanitizePolicyReplayPreviewMigrationSample({
      id: 42,
      tmdb_id: 10674,
      title: 'Mulan',
      year: 1998,
      media_type: 'movie',
      library_name: 'Animated Movies',
      confidence: '81.22',
      method: 'ai_analysis',
      status: 'completed',
      reason: 'Long internal reasoning should not leak',
      metadata: { rating: 'G' },
      created_at: '2026-06-01T10:00:00.000Z',
    }, 0);

    expect(sample).toEqual({
      sample_id: 1,
      title: 'Mulan',
      year: 1998,
      media_type: 'movie',
      library_name: 'Animated Movies',
      current_confidence: 81.22,
      current_method: 'ai_analysis',
      current_status: 'completed',
      current_outcome: 'final_success',
      created_at: '2026-06-01T10:00:00.000Z',
    });
    expect(sample).not.toHaveProperty('id');
    expect(sample).not.toHaveProperty('tmdb_id');
    expect(sample).not.toHaveProperty('metadata');
    expect(sample).not.toHaveProperty('reason');
  });

  test('returns bounded, provider-free migration support', () => {
    const preview = buildPolicyReplayPreviewMigrationVerifier({
      impactPreview: {
        validation: { valid: true, errors: [] },
        comparison: {
          parity: 'changed',
          impact_level: 'medium',
          changed_buckets: ['boosters'],
        },
      },
      samples: [{ title: 'Sample', status: 'pending', created_at: null }],
      sampleDiagnostics: {
        enabled: true,
        selection_status: 'selected',
        total_history_count: 3,
      },
      evidenceCompleteness: {
        enabled: true,
        sample_count: 1,
        strong_count: 1,
      },
      requestedLimit: 2,
    });

    expect(preview).toEqual(expect.objectContaining({
      mode: 'read_only_replay_migration_verifier',
      persistence_enabled: false,
      execution: {
        classification_run: false,
        ai_calls_enabled: false,
        provider_calls_enabled: false,
        arr_writes_enabled: false,
      },
      impact_summary: {
        parity: 'changed',
        impact_level: 'medium',
        changed_bucket_count: 1,
      },
      sample: expect.objectContaining({
        requested_limit: 2,
        returned_count: 1,
        diagnostics: expect.objectContaining({
          enabled: true,
          selection_status: 'selected',
        }),
        evidence_completeness: expect.objectContaining({
          enabled: true,
          sample_count: 1,
          strong_count: 1,
        }),
      }),
    }));

    expect(preview.sample).not.toHaveProperty('enrichment_eligibility');
    expect(preview.sample).not.toHaveProperty('provider_readiness');
    expect(preview.sample).not.toHaveProperty('enrichment_adapter_contract');
    expect(preview.sample).not.toHaveProperty('tmdb_metadata_adapter_preview');
    expect(preview.sample).not.toHaveProperty('tmdb_metadata_coverage_comparison');
  });
});
