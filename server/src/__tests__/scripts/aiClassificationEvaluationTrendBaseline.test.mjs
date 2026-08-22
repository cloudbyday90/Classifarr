/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  AiClassificationEvaluationTrendBaselineValidationError,
  compareAiClassificationEvaluationSweepReports,
} from '../../../../scripts/lib/aiClassificationEvaluationTrendBaseline.mjs';

const FINGERPRINTS = Object.freeze({
  fixture: 'a'.repeat(64),
  policy: 'b'.repeat(64),
  runtime: 'c'.repeat(64),
  outcomePass: 'd'.repeat(64),
  outcomeFail: 'e'.repeat(64),
});

function createEvaluatedRow({
  fixtureId = 'fixture-one',
  model = 'qwen3.5:4b',
  evaluationSource = 'queued_decision_witness',
  passed = true,
  fingerprints = {},
  rawProviderPayload = 'must never enter the trend artifact',
} = {}) {
  return {
    model,
    rawProviderPayload,
    evaluation: {
      status: 'evaluated',
      fixtureId,
      evaluationSource,
      result: { passed },
      fingerprints: {
        fixture: { algorithm: 'sha256', fingerprint: fingerprints.fixture ?? FINGERPRINTS.fixture },
        policy: { algorithm: 'sha256', fingerprint: fingerprints.policy ?? FINGERPRINTS.policy },
        runtime: { algorithm: 'sha256', fingerprint: fingerprints.runtime ?? FINGERPRINTS.runtime },
        outcome: {
          algorithm: 'sha256',
          fingerprint: fingerprints.outcome ?? (passed ? FINGERPRINTS.outcomePass : FINGERPRINTS.outcomeFail),
        },
      },
    },
  };
}

function createReport(results) {
  return { results };
}

describe('AI classification evaluation trend baseline', () => {
  test('reports a stable matching cohort without retaining raw report fields', () => {
    const report = createReport([createEvaluatedRow()]);
    const artifact = compareAiClassificationEvaluationSweepReports({
      baselineReport: report,
      candidateReport: report,
      createdAt: '2026-08-22T00:00:00.000Z',
    });

    expect(artifact.summary).toEqual(expect.objectContaining({
      comparedCohortCount: 1,
      humanReviewRequired: false,
      recommendation: 'no_delta_detected_human_release_decision_still_required',
      regressionCount: 0,
      stableCount: 1,
    }));
    expect(artifact.comparisons.matching[0]).toEqual(expect.objectContaining({
      humanReviewRequired: false,
      status: 'stable',
    }));
    expect(artifact.authority.automaticActions).toEqual({
      deployment: false,
      policyChange: false,
      release: false,
      routing: false,
    });
    expect(JSON.stringify(artifact)).not.toContain('must never enter the trend artifact');
  });

  test('aggregates repeated runs and requires review for a matching pass-rate regression', () => {
    const baselineReport = createReport([
      createEvaluatedRow(),
      createEvaluatedRow(),
    ]);
    const candidateReport = createReport([
      createEvaluatedRow(),
      createEvaluatedRow({ passed: false }),
    ]);

    const artifact = compareAiClassificationEvaluationSweepReports({
      baselineReport,
      candidateReport,
      createdAt: '2026-08-22T00:00:00.000Z',
    });

    expect(artifact.summary).toEqual(expect.objectContaining({
      humanReviewRequired: true,
      regressionCount: 1,
    }));
    expect(artifact.comparisons.matching[0]).toEqual(expect.objectContaining({
      status: 'pass_rate_regressed',
      humanReviewRequired: true,
      baseline: expect.objectContaining({
        aggregate: expect.objectContaining({ passRate: 1, evaluatedCount: 2 }),
      }),
      candidate: expect.objectContaining({
        aggregate: expect.objectContaining({ passRate: 0.5, evaluatedCount: 2 }),
      }),
    }));
  });

  test('treats a policy, runtime, or witness-context change as incomparable review evidence', () => {
    const baselineReport = createReport([createEvaluatedRow()]);
    const candidateReport = createReport([createEvaluatedRow({
      fingerprints: { runtime: 'f'.repeat(64) },
    })]);

    const artifact = compareAiClassificationEvaluationSweepReports({
      baselineReport,
      candidateReport,
      createdAt: '2026-08-22T00:00:00.000Z',
    });

    expect(artifact.summary).toEqual(expect.objectContaining({
      comparedCohortCount: 0,
      contextChangedCount: 2,
      humanReviewRequired: true,
      regressionCount: 0,
    }));
    expect(artifact.comparisons.candidateOnly[0]).toEqual(expect.objectContaining({
      status: 'context_changed',
      humanReviewRequired: true,
    }));
    expect(artifact.comparisons.baselineOnly[0]).toEqual(expect.objectContaining({
      status: 'context_changed',
      humanReviewRequired: true,
    }));
  });

  test('requires review when a matching cohort uses a different repeat count', () => {
    const baselineReport = createReport([createEvaluatedRow()]);
    const candidateReport = createReport([
      createEvaluatedRow(),
      createEvaluatedRow(),
    ]);

    const artifact = compareAiClassificationEvaluationSweepReports({
      baselineReport,
      candidateReport,
      createdAt: '2026-08-22T00:00:00.000Z',
    });

    expect(artifact.comparisons.matching[0]).toEqual(expect.objectContaining({
      humanReviewRequired: true,
      status: 'sample_size_changed',
    }));
  });

  test('fails closed when an evaluated row has an invalid fingerprint', () => {
    const invalidReport = createReport([createEvaluatedRow({
      fingerprints: { policy: 'not-a-fingerprint' },
    })]);

    expect(() => compareAiClassificationEvaluationSweepReports({
      baselineReport: invalidReport,
      candidateReport: invalidReport,
      createdAt: '2026-08-22T00:00:00.000Z',
    })).toThrow(AiClassificationEvaluationTrendBaselineValidationError);
  });

  test('surfaces ungraded rows as coverage degradation without copying their contents', () => {
    const baselineReport = createReport([createEvaluatedRow()]);
    const candidateReport = createReport([
      createEvaluatedRow(),
      { evaluation: { status: 'not_evaluated', reasonId: 'not-safe-to-copy' } },
    ]);

    const artifact = compareAiClassificationEvaluationSweepReports({
      baselineReport,
      candidateReport,
      createdAt: '2026-08-22T00:00:00.000Z',
    });

    expect(artifact.summary).toEqual(expect.objectContaining({
      coverageDegraded: true,
      humanReviewRequired: true,
    }));
    expect(artifact.reports.candidate.ungradedRowCount).toBe(1);
    expect(JSON.stringify(artifact)).not.toContain('not-safe-to-copy');
  });

  test('excludes intentionally unversioned rows without reporting lost evaluation coverage', () => {
    const baselineReport = createReport([createEvaluatedRow()]);
    const candidateReport = createReport([
      createEvaluatedRow(),
      { evaluation: { status: 'not_requested' } },
    ]);

    const artifact = compareAiClassificationEvaluationSweepReports({
      baselineReport,
      candidateReport,
      createdAt: '2026-08-22T00:00:00.000Z',
    });

    expect(artifact.summary).toEqual(expect.objectContaining({
      coverageDegraded: false,
      humanReviewRequired: false,
    }));
    expect(artifact.reports.candidate).toEqual(expect.objectContaining({
      excludedRowCount: 1,
      ungradedRowCount: 0,
    }));
  });
});
