/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS,
  validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocument,
} from './policyCandidateEvidenceOfflineEvaluationContract.mjs';
import {
  buildPolicyCandidateEvidenceOfflineSignalDecisions,
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SIGNAL_IDS,
} from './policyCandidateEvidenceOfflineEvaluationSignalMapping.mjs';
import {
  buildPolicyCandidateEvidenceOfflineSignalMetrics,
} from './policyCandidateEvidenceOfflineEvaluationMetrics.mjs';

export const POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_REPORT_VERSION =
  'policy.candidate_evidence_offline_evaluation_report.v1';

const SIGNAL_IDS = Object.freeze(Object.values(POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SIGNAL_IDS));

function buildAuthority() {
  return Object.freeze({
    scope: 'offline_evaluation_only',
    operatorWorkflowAdmission: false,
    automaticActions: Object.freeze({
      aiInvocation: false,
      learning: false,
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
        .map((issue) => issue?.riskId)
        .filter((riskId) => typeof riskId === 'string'),
    )].sort()),
  });
}

function buildFixtureResult(fixture) {
  const signalDecisions = buildPolicyCandidateEvidenceOfflineSignalDecisions(fixture.observations);
  return Object.freeze({
    fixtureId: fixture.id,
    referenceDecisionId: fixture.reference.decisionId,
    signalDecisions,
  });
}

function buildMetrics(results) {
  return Object.freeze(SIGNAL_IDS.map((signalId) => (
    buildPolicyCandidateEvidenceOfflineSignalMetrics({
      signalId,
      rows: results.map((result) => ({
        referenceDecisionId: result.referenceDecisionId,
        signalDecisionId: result.signalDecisions[signalId],
      })),
    })
  )));
}

/**
 * Evaluates a static, human-reviewed fixture document with no provider, model,
 * database, HTTP, filesystem, history, policy, or routing dependency. A future
 * adapter must undergo an explicit design and security review before it can
 * supply a semantic proposal to any operator-facing workflow.
 */
export function evaluatePolicyCandidateEvidenceOfflineFixtureDocument(document) {
  const validation = validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocument(document);
  const projectedValidation = projectValidation(validation);
  if (!validation.ok) {
    return Object.freeze({
      version: POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_REPORT_VERSION,
      authority: buildAuthority(),
      validation: projectedValidation,
      results: Object.freeze([]),
      metrics: Object.freeze([]),
      summary: Object.freeze({
        fixtureCount: 0,
        referenceAbstainCount: 0,
        referenceAdmitCount: 0,
        referenceReviewCount: 0,
      }),
    });
  }

  const results = Object.freeze(document.map(buildFixtureResult));
  const referenceDecisionCount = (decisionId) => results.filter((result) => (
    result.referenceDecisionId === decisionId
  )).length;

  return Object.freeze({
    version: POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_REPORT_VERSION,
    authority: buildAuthority(),
    validation: projectedValidation,
    results,
    metrics: buildMetrics(results),
    summary: Object.freeze({
      fixtureCount: results.length,
      referenceAbstainCount: referenceDecisionCount(
        POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS.ABSTAIN,
      ),
      referenceAdmitCount: referenceDecisionCount(
        POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS.ADMIT,
      ),
      referenceReviewCount: referenceDecisionCount(
        POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS.REVIEW,
      ),
    }),
  });
}
