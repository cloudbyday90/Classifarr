/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixtureCorpus,
} from '../../services/policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyOfflineEvaluation.mjs';

function buildScenario(overrides = {}) {
  return {
    providerRecoveryReviewRequired: false,
    manualEvidenceReviewRequired: false,
    aiAdvisory: false,
    policyAutoProvenance: 'current',
    requireAllConfirmations: false,
    fallbackResult: false,
    lowConfidence: false,
    clarificationRequested: false,
    ...overrides,
  };
}

function buildCorpus() {
  const fixtures = [
    ['baseline-current-policy-auto', {}, true, null, []],
    ['provider-recovery', { providerRecoveryReviewRequired: true }, false, 'provider_recovery_review_required', ['provider_recovery_review_required']],
    ['manual-evidence', { manualEvidenceReviewRequired: true }, false, 'manual_policy_evidence_review_required', ['manual_policy_evidence_review_required']],
    ['ai-advisory', { aiAdvisory: true }, false, 'ai_advisory_cannot_route', ['ai_advisory_cannot_route']],
    ['provenance', { policyAutoProvenance: 'mismatched_library' }, false, 'policy_auto_provenance_required', ['policy_auto_provenance_required']],
    ['confirmation', { requireAllConfirmations: true }, false, 'administrative_confirmation_required', ['administrative_confirmation_required']],
    ['fallback', { fallbackResult: true }, false, 'fallback_result_review_required', ['fallback_result_review_required']],
    ['low-confidence', { lowConfidence: true }, false, 'low_confidence_review_required', ['low_confidence_review_required']],
    ['clarification', { clarificationRequested: true }, false, 'clarification_requested', ['clarification_requested']],
  ];

  return {
    version: 'policy.candidate_correction_policy_change_calibration_route_safety_fixture_corpus.v1',
    fixtures: fixtures.map(([id, scenario, automaticRouteAllowed, primaryGateId, blockingGateIds]) => ({
      id,
      scenario: buildScenario(scenario),
      expected: { automaticRouteAllowed, primaryGateId, blockingGateIds },
    })),
  };
}

describe('policy-change calibration route-safety offline evaluation', () => {
  test('passes synthetic high-score route gates without routing authority', () => {
    const result =
      evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixtureCorpus(buildCorpus());

    expect(result).toEqual(expect.objectContaining({
      statusId: 'passed',
      summary: { fixtureCount: 9, matchedExpectationCount: 9, mismatchCount: 0 },
      validation: { ok: true, fixtureCount: 9, issueCount: 0, riskIds: [] },
      authority: expect.objectContaining({
        scope: 'offline_synthetic_route_safety_comparison_only',
        automaticActions: expect.objectContaining({ routing: false, policyChange: false }),
      }),
    }));
  });

  test('reports only aggregate mismatch data when a guard expectation drifts', () => {
    const corpus = buildCorpus();
    corpus.fixtures[3].expected = {
      automaticRouteAllowed: true,
      primaryGateId: null,
      blockingGateIds: [],
    };

    expect(evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixtureCorpus(corpus))
      .toEqual(expect.objectContaining({
        statusId: 'expectation_mismatch',
        summary: { fixtureCount: 9, matchedExpectationCount: 8, mismatchCount: 1 },
      }));
  });

  test('fails closed for a corpus carrying a forbidden runtime field', () => {
    const corpus = buildCorpus();
    corpus.fixtures[0].providerEndpoint = 'not-permitted';
    const result =
      evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixtureCorpus(corpus);

    expect(result).toEqual(expect.objectContaining({
      statusId: 'invalid_fixture_corpus',
      summary: { fixtureCount: 0, matchedExpectationCount: 0, mismatchCount: 0 },
    }));
    expect(JSON.stringify(result)).not.toMatch(/baseline-current-policy-auto|not-permitted/iu);
  });
});
