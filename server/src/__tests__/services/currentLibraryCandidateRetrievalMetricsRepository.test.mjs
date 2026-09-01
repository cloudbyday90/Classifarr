/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  LOAD_CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_METRICS_SQL,
  loadCurrentLibraryCandidateRetrievalMetrics,
} from '../../services/currentLibraryCandidateRetrievalMetricsRepository.mjs';

describe('currentLibraryCandidateRetrievalMetricsRepository', () => {
  test('uses a static aggregate query with only the bounded version parameters', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [{ observationCount: '4' }] }) };
    const start = new Date('2026-08-20T00:00:00.000Z');
    const end = new Date('2026-08-27T00:00:00.000Z');

    await expect(loadCurrentLibraryCandidateRetrievalMetrics(db, { start, end }))
      .resolves.toEqual({ observationCount: '4' });

    expect(db.query).toHaveBeenCalledWith(LOAD_CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_METRICS_SQL, [
      '2026-08-20T00:00:00.000Z',
      '2026-08-27T00:00:00.000Z',
      'current_library.candidate_retrieval_telemetry.v1',
      'policy.candidate_adjudication.v1',
      'proposed',
      'abstained',
      'response_rejected',
      'current_library.candidate_retrieval_outcome_attribution.v1',
      'policy_confirmation_required',
    ]);
    expect(LOAD_CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_METRICS_SQL).toContain('COUNT(*)');
    expect(LOAD_CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_METRICS_SQL).toContain('leading_declared_evidence_mode');
    expect(LOAD_CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_METRICS_SQL).toContain('semantic_retrieval_status_id');
    expect(LOAD_CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_METRICS_SQL).not.toContain('SELECT title');
    expect(LOAD_CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_METRICS_SQL).not.toContain('provider_id');
    expect(LOAD_CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_METRICS_SQL).not.toContain('library_name');
    expect(LOAD_CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_METRICS_SQL).not.toContain('policy_name');
  });

  test('rejects invalid aggregate ranges before querying', async () => {
    const db = { query: jest.fn() };

    await expect(loadCurrentLibraryCandidateRetrievalMetrics(db, {
      start: new Date('2026-08-27T00:00:00.000Z'),
      end: new Date('2026-08-20T00:00:00.000Z'),
    })).rejects.toThrow('valid aggregate observation range');
    expect(db.query).not.toHaveBeenCalled();
  });
});
