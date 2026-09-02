/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  LOAD_CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_WORKBENCH_METRICS_SQL,
  loadCurrentLibraryCandidateSemanticAdjudicationWorkbenchMetrics,
} from '../../services/currentLibraryCandidateSemanticAdjudicationWorkbenchMetricsRepository.mjs';

describe('currentLibraryCandidateSemanticAdjudicationWorkbenchMetricsRepository', () => {
  test('selects only count-only aggregates from the newest opaque cohort', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [{ comparisonCount: '4' }] }) };
    const start = new Date('2026-08-20T00:00:00.000Z');
    const end = new Date('2026-08-27T00:00:00.000Z');

    await expect(loadCurrentLibraryCandidateSemanticAdjudicationWorkbenchMetrics(db, { start, end }))
      .resolves.toEqual({ comparisonCount: '4' });

    expect(db.query).toHaveBeenCalledWith(
      LOAD_CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_WORKBENCH_METRICS_SQL,
      [
        '2026-08-20T00:00:00.000Z',
        '2026-08-27T00:00:00.000Z',
        'policy.candidate_adjudication.v1',
        'policy.candidate_semantic_adjudication_proposal.v1',
        'proposed',
        'abstained',
        'response_rejected',
      ],
    );
    expect(LOAD_CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_WORKBENCH_METRICS_SQL)
      .toContain('GROUP BY proposal_fingerprint');
    expect(LOAD_CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_WORKBENCH_METRICS_SQL)
      .toContain('semantic_outcome_calibration_status_id');
    expect(LOAD_CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_WORKBENCH_METRICS_SQL)
      .toContain('outcomeCalibratedResolvedProposalCount');
    expect(LOAD_CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_WORKBENCH_METRICS_SQL)
      .not.toContain('SELECT title');
    expect(LOAD_CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_WORKBENCH_METRICS_SQL)
      .not.toContain('library_name');
    expect(LOAD_CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_WORKBENCH_METRICS_SQL)
      .not.toContain('provider_id');
  });

  test('rejects invalid ranges before querying', async () => {
    const db = { query: jest.fn() };

    await expect(loadCurrentLibraryCandidateSemanticAdjudicationWorkbenchMetrics(db, {
      start: new Date('2026-08-27T00:00:00.000Z'),
      end: new Date('2026-08-20T00:00:00.000Z'),
    })).rejects.toThrow('valid aggregate observation range');
    expect(db.query).not.toHaveBeenCalled();
  });
});
