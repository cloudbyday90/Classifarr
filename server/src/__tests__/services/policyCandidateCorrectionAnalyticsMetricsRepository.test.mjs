/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  LOAD_POLICY_CANDIDATE_CORRECTION_ANALYTICS_METRICS_SQL,
  loadPolicyCandidateCorrectionAnalyticsMetrics,
} from '../../services/policyCandidateCorrectionAnalyticsMetricsRepository.mjs';

describe('policyCandidateCorrectionAnalyticsMetricsRepository', () => {
  test('uses one static aggregate query with only fixed dimensions', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({
        rows: [{ rowKind: 'margin_band', scoreMarginBandId: '5_to_14', outcomeCount: '4' }],
      }),
    };
    const start = new Date('2026-08-20T00:00:00.000Z');
    const end = new Date('2026-08-27T00:00:00.000Z');

    await expect(loadPolicyCandidateCorrectionAnalyticsMetrics(db, { start, end }))
      .resolves.toEqual([{ rowKind: 'margin_band', scoreMarginBandId: '5_to_14', outcomeCount: '4' }]);

    expect(db.query).toHaveBeenCalledWith(
      LOAD_POLICY_CANDIDATE_CORRECTION_ANALYTICS_METRICS_SQL,
      expect.arrayContaining([
        '2026-08-20T00:00:00.000Z',
        '2026-08-27T00:00:00.000Z',
        'policy.candidate_correction_outcome_attribution.v1',
        'confirmed_candidate',
        'changed_to_candidate',
        'changed_outside_candidates',
        'routed_not_applicable',
      ]),
    );
    expect(LOAD_POLICY_CANDIDATE_CORRECTION_ANALYTICS_METRICS_SQL).toContain('COUNT(*)');
    expect(LOAD_POLICY_CANDIDATE_CORRECTION_ANALYTICS_METRICS_SQL).toContain('jsonb_array_elements');
    expect(LOAD_POLICY_CANDIDATE_CORRECTION_ANALYTICS_METRICS_SQL).not.toContain('SELECT title');
    expect(LOAD_POLICY_CANDIDATE_CORRECTION_ANALYTICS_METRICS_SQL).not.toContain('library_name');
    expect(LOAD_POLICY_CANDIDATE_CORRECTION_ANALYTICS_METRICS_SQL).not.toContain('provider_id');
    expect(LOAD_POLICY_CANDIDATE_CORRECTION_ANALYTICS_METRICS_SQL).not.toContain('actor');
  });

  test('rejects an invalid aggregate range before querying', async () => {
    const db = { query: jest.fn() };

    await expect(loadPolicyCandidateCorrectionAnalyticsMetrics(db, {
      start: new Date('2026-08-27T00:00:00.000Z'),
      end: new Date('2026-08-20T00:00:00.000Z'),
    })).rejects.toThrow('valid aggregate observation range');
    expect(db.query).not.toHaveBeenCalled();
  });
});
