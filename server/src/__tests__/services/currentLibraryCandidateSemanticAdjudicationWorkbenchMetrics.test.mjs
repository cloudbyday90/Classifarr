/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildCurrentLibraryCandidateSemanticAdjudicationWorkbenchMetrics,
} from '../../services/currentLibraryCandidateSemanticAdjudicationWorkbenchMetrics.mjs';

describe('currentLibraryCandidateSemanticAdjudicationWorkbenchMetrics', () => {
  test('waits for an opaque frozen proposal cohort without manufacturing an evaluation', () => {
    const report = buildCurrentLibraryCandidateSemanticAdjudicationWorkbenchMetrics();

    expect(report.status).toMatchObject({ id: 'no_frozen_proposal', automaticRoutingEligibility: false });
    expect(report.cohort).toMatchObject({ comparisonCount: 0, agreementRatePercent: 0 });
    expect(report.authority.automaticActions).toEqual(expect.objectContaining({
      aiInvocation: false,
      ragTuning: false,
      routing: false,
    }));
  });

  test('keeps only the latest frozen cohort aggregate and requires resolved operator decisions', () => {
    const report = buildCurrentLibraryCandidateSemanticAdjudicationWorkbenchMetrics({
      row: {
        proposalGroupCount: 2,
        comparisonCount: 16,
        proposalCount: 13,
        abstainedCount: 2,
        responseRejectedCount: 1,
        resolvedProposalCount: 12,
        alignedProposalCount: 9,
        semanticContextAvailableCount: 11,
        title: 'must never reach a report',
      },
    });

    expect(report.status).toMatchObject({ id: 'ready_for_human_review', policyChangeEligibility: false });
    expect(report.proposalGroupCount).toBe(2);
    expect(report.cohort).toMatchObject({
      comparisonCount: 16,
      resolvedProposalCount: 12,
      alignedProposalCount: 9,
      alternativeProposalCount: 3,
      agreementRatePercent: 75,
    });
    expect(JSON.stringify(report)).not.toContain('must never');
  });

  test('fails closed by bounding inconsistent aggregate counts', () => {
    const report = buildCurrentLibraryCandidateSemanticAdjudicationWorkbenchMetrics({
      row: {
        proposalGroupCount: 1,
        comparisonCount: 2,
        proposalCount: 99,
        abstainedCount: 99,
        responseRejectedCount: 99,
        resolvedProposalCount: 99,
        alignedProposalCount: 99,
        semanticContextAvailableCount: 99,
      },
    });

    expect(report.status.id).toBe('collecting');
    expect(report.cohort).toMatchObject({
      proposalCount: 2,
      abstainedCount: 0,
      responseRejectedCount: 0,
      resolvedProposalCount: 2,
      alignedProposalCount: 2,
      semanticContextAvailableCount: 2,
    });
  });
});
