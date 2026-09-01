/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import {
  listPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationAggregates,
} from '../../services/policyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationPersistence.mjs';

describe('representative review-corpus capture evaluation persistence', () => {
  test('queries only current-revision aggregate dimensions', async () => {
    const dbClient = {
      query: jest.fn().mockResolvedValue({ rows: [{
        score_margin_band_id: '0_to_4',
        selection_status_id: 'confirmed_candidate',
        capture_count: 3,
      }] }),
    };

    await expect(listPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationAggregates({
      dbClient,
      configurationRevision: 'a'.repeat(64),
      now: '2026-09-01T00:00:00.000Z',
    })).resolves.toEqual([{
      score_margin_band_id: '0_to_4',
      selection_status_id: 'confirmed_candidate',
      capture_count: 3,
    }]);

    const [query, params] = dbClient.query.mock.calls[0];
    expect(params).toEqual(['a'.repeat(64), '2026-09-01T00:00:00.000Z']);
    expect(query).toContain('GROUP BY score_margin_band_id, selection_status_id');
    for (const forbiddenColumn of [
      'capture_id', 'captured_by_actor_id', 'evidence_source_states', 'media', 'library', 'prompt', 'response',
    ]) {
      expect(query).not.toContain(forbiddenColumn);
    }
  });
});
