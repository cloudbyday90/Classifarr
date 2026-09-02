/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildCurrentLibraryCandidateSemanticOutcomeCalibrationEvaluation,
} from '../../services/currentLibraryCandidateSemanticOutcomeCalibrationEvaluation.mjs';

describe('currentLibraryCandidateSemanticOutcomeCalibrationEvaluation', () => {
  test('requires independently sufficient resolved outcomes in both comparable arms', () => {
    const report = buildCurrentLibraryCandidateSemanticOutcomeCalibrationEvaluation({
      hasFrozenProposal: true,
      semanticContextAvailableCount: 33,
      row: {
        outcomeCalibratedComparisonCount: 14,
        outcomeCalibratedProposalCount: 13,
        outcomeCalibratedResolvedProposalCount: 12,
        outcomeCalibratedAlignedProposalCount: 9,
        notOutcomeCalibratedComparisonCount: 13,
        notOutcomeCalibratedProposalCount: 12,
        notOutcomeCalibratedResolvedProposalCount: 12,
        notOutcomeCalibratedAlignedProposalCount: 8,
        noSemanticMatchComparisonCount: 4,
        notRecordedCalibrationComparisonCount: 2,
      },
    });

    expect(report.status).toMatchObject({
      id: 'ready_for_human_review',
      automaticRoutingEligibility: false,
      policyChangeEligibility: false,
      ragTuningEligibility: false,
    });
    expect(report.arms.outcomeCalibrated).toMatchObject({
      resolvedProposalCount: 12,
      alignedProposalCount: 9,
      agreementRatePercent: 75,
    });
    expect(report.arms.notOutcomeCalibrated).toMatchObject({
      resolvedProposalCount: 12,
      alignedProposalCount: 8,
      agreementRatePercent: 66.7,
    });
    expect(report.noSemanticMatchCount).toBe(4);
    expect(report.notRecordedComparisonCount).toBe(2);
  });

  test('fails closed to collecting when a group is sparse or aggregate counts are inconsistent', () => {
    const report = buildCurrentLibraryCandidateSemanticOutcomeCalibrationEvaluation({
      hasFrozenProposal: true,
      semanticContextAvailableCount: 2,
      row: {
        outcomeCalibratedComparisonCount: 99,
        outcomeCalibratedProposalCount: 99,
        outcomeCalibratedResolvedProposalCount: 99,
        outcomeCalibratedAlignedProposalCount: 99,
        notOutcomeCalibratedComparisonCount: 99,
      },
    });

    expect(report.status.id).toBe('collecting');
    expect(report.arms.outcomeCalibrated).toMatchObject({
      comparisonCount: 2,
      proposalCount: 2,
      resolvedProposalCount: 2,
      alignedProposalCount: 2,
    });
    expect(report.arms.notOutcomeCalibrated.comparisonCount).toBe(0);
  });
});
