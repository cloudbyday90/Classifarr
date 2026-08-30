/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildPolicyCandidateEvidenceOfflineSignalMetrics,
} from '../../services/policyCandidateEvidenceOfflineEvaluationMetrics.mjs';

describe('policyCandidateEvidenceOfflineEvaluationMetrics', () => {
  test('reports review precision, recall, abstention, coverage, and agreement separately', () => {
    const metrics = buildPolicyCandidateEvidenceOfflineSignalMetrics({
      signalId: 'semantic_retrieval_proposal',
      rows: [
        { referenceDecisionId: 'review', signalDecisionId: 'review' },
        { referenceDecisionId: 'review', signalDecisionId: 'abstain' },
        { referenceDecisionId: 'admit', signalDecisionId: 'admit' },
        { referenceDecisionId: 'abstain', signalDecisionId: 'review' },
      ],
    });

    expect(metrics).toEqual({
      signalId: 'semantic_retrieval_proposal',
      evaluatedFixtureCount: 4,
      referenceReviewCount: 2,
      predictedReviewCount: 2,
      truePositiveCount: 1,
      falsePositiveCount: 1,
      falseNegativeCount: 1,
      trueNegativeCount: 1,
      abstentionCount: 1,
      agreementCount: 2,
      precisionPercent: 50,
      recallPercent: 50,
      abstentionRatePercent: 25,
      coverageRatePercent: 75,
      decisionAgreementRatePercent: 50,
    });
  });

  test('does not manufacture a metric where its denominator is zero', () => {
    expect(buildPolicyCandidateEvidenceOfflineSignalMetrics({
      signalId: 'empty',
      rows: [{ referenceDecisionId: 'admit', signalDecisionId: 'admit' }],
    })).toEqual(expect.objectContaining({
      precisionPercent: null,
      recallPercent: null,
      abstentionRatePercent: 0,
      coverageRatePercent: 100,
    }));
  });
});
