/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildCurrentLibraryCandidateRetrievalMetricsReport,
  buildCurrentLibraryCandidateRetrievalMetricsWindow,
  normalizeCurrentLibraryCandidateRetrievalMetricsWindowDays,
} from '../../services/currentLibraryCandidateRetrievalTelemetryMetrics.mjs';

describe('currentLibraryCandidateRetrievalTelemetryMetrics', () => {
  test('uses a bounded completed-UTC-day window', () => {
    expect(normalizeCurrentLibraryCandidateRetrievalMetricsWindowDays(0)).toBe(7);
    expect(normalizeCurrentLibraryCandidateRetrievalMetricsWindowDays(100)).toBe(30);

    expect(buildCurrentLibraryCandidateRetrievalMetricsWindow({
      windowDays: 14,
      now: new Date('2026-08-30T18:30:00.000Z'),
    })).toEqual(expect.objectContaining({
      days: 14,
      start: new Date('2026-08-16T00:00:00.000Z'),
      end: new Date('2026-08-30T00:00:00.000Z'),
    }));
  });

  test('reports fixed aggregate counts and frames agreement as observational', () => {
    const report = buildCurrentLibraryCandidateRetrievalMetricsReport({
      window: buildCurrentLibraryCandidateRetrievalMetricsWindow({
        windowDays: 7,
        now: new Date('2026-08-30T18:30:00.000Z'),
      }),
      row: {
        observationCount: 10,
        availableCount: 9,
        unavailableCount: 1,
        matchingObservationCount: 6,
        directMatchObservationCount: 4,
        under25msCount: 3,
        from25To99msCount: 4,
        from100To249msCount: 2,
        from250To999msCount: 1,
        from1000msOrMoreCount: 0,
        proposalCount: 5,
        candidateAdjudicationComparisonCount: 8,
        candidateAdjudicationAbstainedCount: 2,
        candidateAdjudicationResponseRejectedCount: 1,
        resolvedProposalCount: 4,
        agreedProposalCount: 3,
        alternativeProposalCount: 1,
        semanticAvailableComparisonCount: 5,
        semanticAvailableProposalCount: 4,
        semanticAvailableResolvedProposalCount: 3,
        semanticAvailableAgreedProposalCount: 2,
        semanticUnavailableComparisonCount: 2,
        semanticUnavailableProposalCount: 1,
        semanticUnavailableResolvedProposalCount: 1,
        semanticUnavailableAgreedProposalCount: 1,
        semanticNotRecordedComparisonCount: 1,
        resolvedOperatorOutcomeCount: 6,
        confirmedCandidateOutcomeCount: 2,
        changedToCandidateOutcomeCount: 1,
        changedOutsideCandidateOutcomeCount: 2,
        routedNotApplicableOutcomeCount: 1,
        confirmationEvidenceObservationCount: 20,
        specializedDeclaredEvidenceCount: 11,
        compatibilityOnlyEvidenceCount: 5,
        profileEvidenceCount: 8,
        patternEvidenceCount: 3,
        ragEvidenceCount: 7,
        historyEvidenceCount: 2,
        calibrationAppliedCount: 9,
      },
    });

    expect(report).toMatchObject({
      version: 'current_library.candidate_retrieval_metrics.v1',
      retrieval: {
        observationCount: 10,
        availabilityRatePercent: 90,
        matchingObservationCount: 6,
        directMatchObservationCount: 4,
      },
      operatorAgreement: {
        proposalCount: 5,
        resolvedProposalCount: 4,
        agreedProposalCount: 3,
        alternativeProposalCount: 1,
        pendingProposalCount: 1,
        agreementRatePercent: 75,
      },
      candidateAdjudication: {
        comparisonCount: 8,
        proposalCount: 5,
        abstainedCount: 2,
        responseRejectedCount: 1,
        unclassifiedComparisonCount: 0,
        semanticContext: expect.arrayContaining([
          expect.objectContaining({
            statusId: 'available',
            comparisonCount: 5,
            proposalCount: 4,
            resolvedProposalCount: 3,
            agreedProposalCount: 2,
            agreementRatePercent: 66.7,
          }),
          expect.objectContaining({
            statusId: 'unavailable',
            comparisonCount: 2,
            proposalCount: 1,
            resolvedProposalCount: 1,
            agreedProposalCount: 1,
            agreementRatePercent: 100,
          }),
        ]),
      },
      operatorCandidateSetAttribution: {
        resolvedOperatorOutcomeCount: 6,
        attributedOperatorOutcomeCount: 6,
        confirmedCandidateOutcomeCount: 2,
        changedToCandidateOutcomeCount: 1,
        changedOutsideCandidateOutcomeCount: 2,
        routedNotApplicableOutcomeCount: 1,
        unattributedResolvedOutcomeCount: 0,
        candidateSetSelectionRatePercent: 60,
      },
      candidateSetPolicyReview: {
        version: 'current_library.candidate_retrieval_policy_review_readiness.v1',
        statusId: 'insufficient_data',
        applicableDecisionCount: 5,
        outsideCandidateOutcomeCount: 2,
        outsideCandidateRatePercent: 40,
      },
      policyConfirmationEvidence: {
        version: 'current_library.policy_confirmation_evidence_readiness.v2',
        statusId: 'evidence_mix_inconclusive',
        confirmationObservationCount: 20,
        declaredScope: {
          specializedEvidenceCount: 11,
          specializedEvidenceRatePercent: 55,
          compatibilityOnlyEvidenceCount: 5,
          noDeclaredEvidenceCount: 4,
          specializedEvidenceConfidenceInterval: {
            methodId: 'wilson_score',
            confidenceLevelPercent: 95,
            lowerRatePercent: 34.2,
            upperRatePercent: 74.2,
          },
        },
        calibration: { appliedCount: 9, appliedRatePercent: 45 },
      },
      readiness: { statusId: 'observing' },
    });
    expect(report.retrieval.latencyBands).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: '25_to_99ms', count: 4, ratePercent: 40 }),
    ]));
    expect(JSON.stringify(report)).not.toContain('library_id');
    expect(JSON.stringify(report)).not.toContain('title');
    expect(JSON.stringify(report)).not.toContain('policy_id');
  });
});
