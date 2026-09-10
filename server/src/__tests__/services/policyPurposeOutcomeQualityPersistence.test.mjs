/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';
import {
  loadPolicyPurposeOutcomeQualityRecords,
} from '../../services/policyPurposeOutcomeQualityPersistence.mjs';

describe('policyPurposeOutcomeQualityPersistence', () => {
  test('compares only declared genre terms with repeated, anchored manual outcomes inside PostgreSQL', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{
      library_id: 11,
      confirmed_outcome_term_count: 1,
      declared_purpose_aligned_outcome_term_count: 1,
    }] });

    await expect(loadPolicyPurposeOutcomeQualityRecords({
      db: { query },
      records: [{ library_id: 11, library_media_type: 'movie' }],
    })).resolves.toEqual([{
      library_id: 11,
      confirmed_outcome_term_count: 1,
      declared_purpose_aligned_outcome_term_count: 1,
    }]);

    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain('jsonb_to_recordset($1::jsonb)');
    expect(sql).toContain('declared_genre_terms AS');
    expect(sql).toContain('confirmed_outcome_genre_terms AS');
    expect(sql).toContain("rule.signal_type = 'genres'");
    expect(sql).toContain("rule.source IN ('native_intent', 'operator_declared_intent')");
    expect(sql).toContain("evidence.scope = 'genre'");
    expect(sql).toContain('evidence.source_classification_id IS NOT NULL');
    expect(sql).toContain('evidence.usage_count >= $4');
    expect(sql).not.toContain('library.name');
    expect(sql).not.toContain('policy.name');
    expect(sql).not.toContain('classification_history');
    expect(sql).not.toContain('rag_');
    expect(sql).not.toContain('evidence_data AS');
    expect(values).toEqual([
      JSON.stringify([{ library_id: 11, media_type: 'movie' }]),
      'policy_authorized_compatibility',
      JSON.stringify({ authoritySourceId: 'manual_outcome' }),
      2,
    ]);
  });

  test('does not read outcome evidence without a valid selected library context', async () => {
    const query = jest.fn();

    await expect(loadPolicyPurposeOutcomeQualityRecords({
      db: { query },
      records: [{ library_id: 0, library_media_type: 'movie' }],
    })).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});
