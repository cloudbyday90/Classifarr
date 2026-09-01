/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_SYNTHETIC_REPLAY_FIXTURE_CORPUS_VERSION,
  validatePolicyCandidateSyntheticReplayFixtureCorpus,
} from './policyCandidateSyntheticReplayFixtureContract.mjs';
import { projectPolicyCandidateDecision } from './policyCandidateDecisionProjection.mjs';
import { projectRankedPolicyCandidates } from './policyCandidateRankingProjection.mjs';
import {
  DEFAULT_POLICY_AUTO_CLASSIFY_THRESHOLD,
  DEFAULT_POLICY_PROMPT_THRESHOLD,
} from '../utils/policyThresholds.mjs';

export const POLICY_CANDIDATE_SYNTHETIC_REPLAY_EVALUATION_REPORT_VERSION =
  'policy.candidate_synthetic_replay_evaluation_report.v1';

export const POLICY_CANDIDATE_SYNTHETIC_REPLAY_EVALUATION_STATUS_IDS = Object.freeze({
  EXPECTATION_MISMATCH: 'expectation_mismatch',
  INVALID_FIXTURE_CORPUS: 'invalid_fixture_corpus',
  PASSED: 'passed',
});

function buildAuthority() {
  return Object.freeze({
    scope: 'offline_fixed_synthetic_candidate_projection_only',
    operatorWorkflowAdmission: false,
    automaticActions: Object.freeze({
      aiInvocation: false,
      learning: false,
      persistence: false,
      policyChange: false,
      retry: false,
      routing: false,
    }),
  });
}

function projectValidation(validation) {
  return Object.freeze({
    ok: validation.ok === true,
    fixtureCount: Number.isSafeInteger(validation.fixtureCount) ? validation.fixtureCount : 0,
    issueCount: Array.isArray(validation.issues) ? validation.issues.length : 0,
    riskIds: Object.freeze([...new Set(
      (Array.isArray(validation.issues) ? validation.issues : [])
        .map(issue => issue?.riskId)
        .filter(riskId => typeof riskId === 'string'),
    )].sort()),
  });
}

function toSyntheticEvaluation(candidate) {
  return {
    policy_id: candidate.candidateId,
    library_id: candidate.candidateId,
    score: candidate.rawScore,
    auto_classify_threshold: DEFAULT_POLICY_AUTO_CLASSIFY_THRESHOLD,
    prompt_threshold: DEFAULT_POLICY_PROMPT_THRESHOLD,
    candidate_diagnostics: {
      evidence_class: candidate.evidenceClass,
      primary_anchor_eligible: candidate.primaryAnchorEligible,
      primary_viability: candidate.primaryViability,
    },
  };
}

function projectSyntheticState(candidates) {
  const ranked = projectRankedPolicyCandidates(candidates.map(toSyntheticEvaluation));
  const decision = projectPolicyCandidateDecision({ ranked });
  const leadingCandidate = decision.top || null;

  return {
    actionId: decision.action,
    leadingCandidateId: leadingCandidate?.policy_id ?? null,
    leadingCalibrationReasonCode:
      leadingCandidate?.candidate_diagnostics?.score_calibration?.reason_code ?? null,
  };
}

function matchesExpectation(actual, expected) {
  return actual.baseline.actionId === expected.baselineActionId &&
    actual.baseline.leadingCandidateId === expected.baselineLeadingCandidateId &&
    actual.proposed.actionId === expected.proposedActionId &&
    actual.proposed.leadingCandidateId === expected.proposedLeadingCandidateId &&
    actual.proposed.leadingCalibrationReasonCode === expected.proposedLeadingCalibrationReasonCode;
}

/**
 * Exercises checked-in, opaque synthetic states with the live pure
 * calibration/rank/decision projection. It accepts no paths or runtime data;
 * it cannot call AI/RAG, read a library, mutate policy, persist evidence, or
 * authorize routing. A projected action is test evidence, not route authority.
 */
export function evaluatePolicyCandidateSyntheticReplayFixtureCorpus(corpus) {
  const validation = validatePolicyCandidateSyntheticReplayFixtureCorpus(corpus);
  const projectedValidation = projectValidation(validation);
  if (!validation.ok) {
    return Object.freeze({
      authority: buildAuthority(),
      fixtureCorpusVersion: POLICY_CANDIDATE_SYNTHETIC_REPLAY_FIXTURE_CORPUS_VERSION,
      statusId: POLICY_CANDIDATE_SYNTHETIC_REPLAY_EVALUATION_STATUS_IDS.INVALID_FIXTURE_CORPUS,
      summary: Object.freeze({
        fixtureCount: 0,
        matchedExpectationCount: 0,
        mismatchCount: 0,
        proposedLeadingCandidateChangedCount: 0,
      }),
      validation: projectedValidation,
      version: POLICY_CANDIDATE_SYNTHETIC_REPLAY_EVALUATION_REPORT_VERSION,
    });
  }

  const projections = corpus.fixtures.map((fixture) => ({
    baseline: projectSyntheticState(fixture.baselineCandidates),
    expected: fixture.expected,
    proposed: projectSyntheticState(fixture.proposedCandidates),
  }));
  const matchedExpectationCount = projections.filter(projection =>
    matchesExpectation(projection, projection.expected)
  ).length;
  const proposedLeadingCandidateChangedCount = projections.filter(projection =>
    projection.baseline.leadingCandidateId !== projection.proposed.leadingCandidateId
  ).length;
  const fixtureCount = projections.length;
  const mismatchCount = fixtureCount - matchedExpectationCount;

  return Object.freeze({
    authority: buildAuthority(),
    fixtureCorpusVersion: POLICY_CANDIDATE_SYNTHETIC_REPLAY_FIXTURE_CORPUS_VERSION,
    statusId: mismatchCount === 0
      ? POLICY_CANDIDATE_SYNTHETIC_REPLAY_EVALUATION_STATUS_IDS.PASSED
      : POLICY_CANDIDATE_SYNTHETIC_REPLAY_EVALUATION_STATUS_IDS.EXPECTATION_MISMATCH,
    summary: Object.freeze({
      fixtureCount,
      matchedExpectationCount,
      mismatchCount,
      proposedLeadingCandidateChangedCount,
    }),
    validation: projectedValidation,
    version: POLICY_CANDIDATE_SYNTHETIC_REPLAY_EVALUATION_REPORT_VERSION,
  });
}
