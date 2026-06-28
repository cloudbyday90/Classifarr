/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildPolicyIntentReplaySampleDiagnostics,
  buildPolicyIntentReplaySampleDiagnosticsQuery,
} from '../services/policyIntentReplaySampleDiagnostics.mjs';

describe('policyIntentReplaySampleDiagnostics', () => {
  test('builds a parameterized aggregate diagnostics query', () => {
    const query = buildPolicyIntentReplaySampleDiagnosticsQuery({
      libraryId: '14',
      mediaType: 'movie',
    });

    expect(query.text).toContain('FROM classification_history');
    expect(query.text).toContain('COUNT(*)');
    expect(query.text).toContain('media_type_filtered_out_count');
    expect(query.text).toContain('sparse_evidence_count');
    expect(query.values).toEqual([14, 'movie']);
  });

  test('rejects invalid library ids before query execution', () => {
    expect(() => buildPolicyIntentReplaySampleDiagnosticsQuery({
      libraryId: null,
      mediaType: 'movie',
    })).toThrow('A valid library_id is required for replay diagnostics');
  });

  test('summarizes selected sample diagnostics with bounded counts', () => {
    const diagnostics = buildPolicyIntentReplaySampleDiagnostics({
      row: {
        total_history_count: '12',
        eligible_history_count: '8',
        final_success_count: '5',
        review_or_pending_count: '3',
        media_type_filtered_out_count: '4',
        sparse_evidence_count: '2',
      },
      requestedLimit: 6,
      returnedCount: 5,
      mediaType: 'movie',
    });

    expect(diagnostics).toEqual(expect.objectContaining({
      schema_version: 1,
      mode: 'representative_sample_selection_diagnostics',
      enabled: true,
      requested_limit: 6,
      returned_count: 5,
      media_type_filter: 'movie',
      total_history_count: 12,
      eligible_history_count: 8,
      final_success_count: 5,
      review_or_pending_count: 3,
      media_type_filtered_out_count: 4,
      sparse_evidence_count: 2,
      selection_status: 'selected',
      reason_codes: expect.arrayContaining([
        'status:selected',
        'media_type:filtered',
        'history:final_success_available',
        'history:review_or_pending_available',
        'evidence:sparse_rows_available',
        'limit:not_all_eligible_rows_returned',
      ]),
    }));
  });

  test('explains absent samples when media type filter excludes history', () => {
    const diagnostics = buildPolicyIntentReplaySampleDiagnostics({
      row: {
        total_history_count: 10,
        eligible_history_count: 0,
        media_type_filtered_out_count: 10,
      },
      requestedLimit: 5,
      returnedCount: 0,
      mediaType: 'tv',
    });

    expect(diagnostics).toEqual(expect.objectContaining({
      selection_status: 'media_type_filtered',
      reason_codes: expect.arrayContaining([
        'status:media_type_filtered',
        'media_type:filtered',
      ]),
    }));
  });
});
