/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildPolicyCandidateCorrectionAnalyticsMetricsReport,
} from '../../services/policyCandidateCorrectionAnalyticsMetrics.mjs';
import {
  buildPolicyCandidateCorrectionCohortCompositionReport,
} from '../../services/policyCandidateCorrectionCohortCompositionReport.mjs';

function report(rows) {
  return buildPolicyCandidateCorrectionAnalyticsMetricsReport({
    rows,
    window: {
      days: 7,
      start: new Date('2026-08-23T00:00:00.000Z'),
      end: new Date('2026-08-30T00:00:00.000Z'),
    },
  });
}

function rows({ closeCount, veryCloseCount }) {
  return [
    {
      rowKind: 'margin_band',
      scoreMarginBandId: '0_to_4',
      outcomeCount: veryCloseCount,
    },
    {
      rowKind: 'margin_band',
      scoreMarginBandId: '5_to_14',
      outcomeCount: closeCount,
    },
    {
      rowKind: 'evidence_source_state',
      evidenceSourceId: 'declared_policy',
      evidenceStateId: 'supporting',
      outcomeCount: veryCloseCount,
    },
    {
      rowKind: 'evidence_source_state',
      evidenceSourceId: 'declared_policy',
      evidenceStateId: 'conflicting',
      outcomeCount: closeCount,
    },
  ];
}

describe('policyCandidateCorrectionCohortCompositionReport', () => {
  test('reports margin and fixed evidence-source mix without retaining event identity', () => {
    const composition = buildPolicyCandidateCorrectionCohortCompositionReport({
      currentReport: report(rows({ veryCloseCount: 50, closeCount: 50 })),
      previousReport: report(rows({ veryCloseCount: 90, closeCount: 10 })),
    });

    expect(composition).toMatchObject({
      version: 'policy.candidate_correction_cohort_composition.v1',
      statusId: 'material_shift_detected',
      marginBands: {
        statusId: 'material_shift_detected',
        totalVariationDistancePercent: 40,
      },
    });
    expect(composition.evidenceSources).toEqual([
      expect.objectContaining({
        evidenceSourceId: 'declared_policy',
        comparison: expect.objectContaining({
          statusId: 'material_shift_detected',
          totalVariationDistancePercent: 40,
        }),
      }),
    ]);
    expect(JSON.stringify(composition)).not.toContain('library_id');
    expect(JSON.stringify(composition)).not.toContain('title');
    expect(JSON.stringify(composition)).not.toContain('destination');
  });
});
