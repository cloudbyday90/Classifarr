/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  getPolicyCandidateCorrectionLongHorizonTrendPresentation,
  normalizePolicyCandidateCorrectionLongHorizonTrend,
} from '@/utils/policyCandidateCorrectionLongHorizonTrendPresentation'

function readiness() {
  return {
    version: 'policy.candidate_correction_calibration_readiness.v1',
    statusId: 'review_recommended',
    applicableDecisionCount: 20,
    changedSelectionOutcomeCount: 10,
    changedSelectionRatePercent: 50,
    minimumApplicableDecisionCount: 20,
    reviewThresholdPercent: 20,
    changedSelectionConfidenceInterval: {
      methodId: 'wilson_score',
      confidenceLevelPercent: 95,
      lowerRatePercent: 29.9,
      upperRatePercent: 70.1,
    },
  }
}

function period(startDate, endDate) {
  return {
    window: { days: 28, startDate, endDate },
    summary: {
      outcomeCount: 20,
      confirmedLeaderOutcomeCount: 10,
      changedToCandidateOutcomeCount: 6,
      changedOutsideCandidatesOutcomeCount: 4,
      routedNotApplicableOutcomeCount: 0,
    },
    calibrationReadiness: readiness(),
    evidenceSourceStateBuckets: [
      {
        evidenceSourceId: 'declared_policy',
        evidenceStateId: 'contextual',
        outcomeCount: 20,
        confirmedLeaderOutcomeCount: 10,
        changedToCandidateOutcomeCount: 6,
        changedOutsideCandidatesOutcomeCount: 4,
        routedNotApplicableOutcomeCount: 0,
        calibrationReadiness: readiness(),
      },
    ],
  }
}

function report(overrides = {}) {
  return {
    version: 'policy.candidate_correction_long_horizon_trend.v1',
    current: period('2026-08-02', '2026-08-30'),
    previous: period('2026-07-05', '2026-08-02'),
    cohortComposition: {
      version: 'policy.candidate_correction_cohort_composition.v1',
      statusId: 'composition_comparable',
      materialShiftDimensionCount: 0,
      comparableDimensionCount: 2,
      insufficientDataDimensionCount: 0,
    },
    trend: {
      version: 'policy.candidate_correction_long_horizon_trend.v1',
      statusId: 'sustained_review_signal',
      currentStatusId: 'review_recommended',
      previousStatusId: 'review_recommended',
      currentApplicableDecisionCount: 20,
      previousApplicableDecisionCount: 20,
      cohortCompositionStatusId: 'composition_comparable',
    },
    representativeReviewCorpus: {
      version: 'policy.candidate_correction_representative_review_corpus.v1',
      statusId: 'historical_corpus_design_required',
      historicalRecordAccess: false,
      reviewFrame: {
        periodCount: 2,
        completedUtcDaysPerPeriod: 28,
        strata: ['score_margin_band', 'operator_selection_outcome'],
      },
      requiredSafeguardIds: ['authorization', 'redaction', 'retention', 'operator_audit'],
    },
    ...overrides,
  }
}

describe('policyCandidateCorrectionLongHorizonTrendPresentation', () => {
  it('retains only the fixed aggregate trend contract and client-owned copy', () => {
    const normalized = normalizePolicyCandidateCorrectionLongHorizonTrend(report({
      providerModel: 'Do not display',
    }))

    expect(normalized).toMatchObject({
      trend: { statusId: 'sustained_review_signal' },
      current: {
        summary: { changedSelectionRatePercent: 50 },
        contextualDeclaredPolicyEvidence: { changedSelectionRatePercent: 50 },
      },
    })
    expect(JSON.stringify(normalized)).not.toContain('Do not display')
    expect(getPolicyCandidateCorrectionLongHorizonTrendPresentation(
      normalized.trend.statusId,
    )).toMatchObject({ label: 'Sustained 28-day review signal' })
  })

  it('fails closed when fixed periods, count values, or derived trend are inconsistent', () => {
    const invalidWindow = report()
    invalidWindow.current.window.days = 7
    expect(normalizePolicyCandidateCorrectionLongHorizonTrend(invalidWindow)).toBeNull()

    const nonAdjacentPeriods = report()
    nonAdjacentPeriods.previous.window = {
      days: 28,
      startDate: '2026-07-04',
      endDate: '2026-08-01',
    }
    expect(normalizePolicyCandidateCorrectionLongHorizonTrend(nonAdjacentPeriods)).toBeNull()

    const invalidCount = report()
    invalidCount.current.summary.routedNotApplicableOutcomeCount = null
    expect(normalizePolicyCandidateCorrectionLongHorizonTrend(invalidCount)).toBeNull()

    const invalidTrend = report()
    invalidTrend.trend.statusId = 'sustained_low_signal'
    expect(normalizePolicyCandidateCorrectionLongHorizonTrend(invalidTrend)).toBeNull()

    const invalidCorpus = report()
    invalidCorpus.representativeReviewCorpus.historicalRecordAccess = true
    expect(normalizePolicyCandidateCorrectionLongHorizonTrend(invalidCorpus)).toBeNull()
  })

  it('keeps the contextual declared-policy bucket optional and rejects malformed duplicates', () => {
    const withoutContextualEvidence = report()
    withoutContextualEvidence.current.evidenceSourceStateBuckets = []
    const normalizedWithoutContextualEvidence =
      normalizePolicyCandidateCorrectionLongHorizonTrend(withoutContextualEvidence)
    expect(normalizedWithoutContextualEvidence.current.contextualDeclaredPolicyEvidence).toBeNull()

    const duplicateContextualEvidence = report()
    duplicateContextualEvidence.current.evidenceSourceStateBuckets.push({
      ...duplicateContextualEvidence.current.evidenceSourceStateBuckets[0],
    })
    const normalizedDuplicateContextualEvidence =
      normalizePolicyCandidateCorrectionLongHorizonTrend(duplicateContextualEvidence)
    expect(normalizedDuplicateContextualEvidence.current.contextualDeclaredPolicyEvidence).toBeNull()
  })
})
