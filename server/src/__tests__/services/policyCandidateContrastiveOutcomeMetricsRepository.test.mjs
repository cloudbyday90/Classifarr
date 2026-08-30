/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  LOAD_POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRICS_SQL,
  POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRIC_STATUS_IDS,
  loadPolicyCandidateContrastiveOutcomeMetrics,
} from '../../services/policyCandidateContrastiveOutcomeMetricsRepository.mjs';

describe('policyCandidateContrastiveOutcomeMetricsRepository', () => {
  test('uses one static aggregate query with only fixed versions and bounded status IDs', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({
        rows: [{ contrastiveStatusId: 'alternative_identity_match', observationCount: '4' }],
      }),
    };
    const start = new Date('2026-08-20T00:00:00.000Z');
    const end = new Date('2026-08-27T00:00:00.000Z');

    await expect(loadPolicyCandidateContrastiveOutcomeMetrics(db, { start, end }))
      .resolves.toEqual([{ contrastiveStatusId: 'alternative_identity_match', observationCount: '4' }]);

    expect(db.query).toHaveBeenCalledWith(
      LOAD_POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRICS_SQL,
      expect.arrayContaining([
        '2026-08-20T00:00:00.000Z',
        '2026-08-27T00:00:00.000Z',
        'policy.candidate_contrastive_evidence.v1',
        POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRIC_STATUS_IDS,
        'policy.candidate_contrastive_outcome_attribution.v1',
        'confirmed_candidate',
        'changed_to_candidate',
        'changed_outside_candidates',
        'routed_not_applicable',
      ]),
    );
    expect(LOAD_POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRICS_SQL).toContain('COUNT(*)');
    expect(LOAD_POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRICS_SQL).toContain('ANY($4::text[])');
    expect(LOAD_POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRICS_SQL).not.toContain('SELECT title');
    expect(LOAD_POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRICS_SQL).not.toContain('library_name');
    expect(LOAD_POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRICS_SQL).not.toContain('provider_id');
    expect(LOAD_POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRICS_SQL).not.toContain('actor');
  });

  test('rejects an invalid aggregate range before querying', async () => {
    const db = { query: jest.fn() };

    await expect(loadPolicyCandidateContrastiveOutcomeMetrics(db, {
      start: new Date('2026-08-27T00:00:00.000Z'),
      end: new Date('2026-08-20T00:00:00.000Z'),
    })).rejects.toThrow('valid aggregate observation range');
    expect(db.query).not.toHaveBeenCalled();
  });
});
