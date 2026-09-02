/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS,
  validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocument,
} from './policyCandidateEvidenceOfflineEvaluationContract.mjs';
import {
  buildPolicyCandidateEvidenceOfflineSignalMetrics,
} from './policyCandidateEvidenceOfflineEvaluationMetrics.mjs';
import {
  createPolicyCandidateSemanticSnapshotFingerprint,
} from './policyCandidateSemanticSnapshotFingerprint.mjs';
import {
  buildPolicyCandidateSemanticReferenceSetArtifact,
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS,
} from './policyCandidateSemanticReferenceSetArtifact.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_OFFLINE_EVALUATION_REPORT_VERSION,
} from './policyCandidateSemanticSnapshotOfflineEvaluation.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_AUTHORITY,
  POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_BLOCKER_IDS,
  POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_PROFILE,
  POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_REPORT_VERSION,
  POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_STATUS_IDS,
} from './policyCandidateSemanticCounterEvidenceReadinessContract.mjs';

const VALID_DECISION_IDS = new Set(Object.values(POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS));

function cloneAuthority() {
  return Object.freeze({
    ...POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_AUTHORITY,
    automaticActions: Object.freeze({
      ...POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_AUTHORITY.automaticActions,
    }),
  });
}

function countFixturesWithTag(fixtureDocument, tagId) {
  return fixtureDocument.filter((fixture) => fixture.tags.includes(tagId)).length;
}

function buildCoverage(fixtureDocument) {
  return Object.freeze(POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_PROFILE.requiredStrata.map((stratum) => {
    const fixtureCount = countFixturesWithTag(fixtureDocument, stratum.tagId);
    return Object.freeze({
      fixtureCount,
      minimumFixtureCount: stratum.minimumFixtureCount,
      satisfied: fixtureCount >= stratum.minimumFixtureCount,
      tagId: stratum.tagId,
    });
  }));
}

function hasExpectedAuthority(authority) {
  const expected = POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_AUTHORITY;
  return authority?.scope === expected.scope &&
    authority?.operatorWorkflowAdmission === expected.operatorWorkflowAdmission &&
    authority?.snapshotAccess === expected.snapshotAccess &&
    Object.entries(expected.automaticActions).every(([key, value]) => (
      authority?.automaticActions?.[key] === value
    ));
}

function hasValidSnapshotValidation(validation) {
  return ['binding', 'fixture', 'manifest', 'semanticSnapshot'].every((key) => (
    validation?.[key]?.ok === true && validation[key].issueCount === 0
  ));
}

function buildRows(fixtureDocument, snapshotReport) {
  const resultsByFixtureId = new Map(snapshotReport.evaluation.results.map((result) => [
    result?.fixtureId,
    result,
  ]));
  if (resultsByFixtureId.size !== fixtureDocument.length) return null;

  const rows = [];
  for (const fixture of fixtureDocument) {
    const result = resultsByFixtureId.get(fixture.id);
    const signalDecisionId = result?.signalDecisions?.[
      POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_PROFILE.semanticSignalId
    ];
    if (!result || result.referenceDecisionId !== fixture.reference.decisionId ||
        !VALID_DECISION_IDS.has(signalDecisionId)) {
      return null;
    }
    rows.push(Object.freeze({
      referenceDecisionId: result.referenceDecisionId,
      signalDecisionId,
    }));
  }
  return Object.freeze(rows);
}

function buildSourceValidation(fixtureDocument, snapshotReport) {
  const fixtureValidation = validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocument(fixtureDocument);
  const fixtureDocumentFingerprint = fixtureValidation.ok
    ? createPolicyCandidateSemanticSnapshotFingerprint(fixtureDocument)
    : null;
  const sourceIsValid = fixtureValidation.ok &&
    snapshotReport?.version === POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_OFFLINE_EVALUATION_REPORT_VERSION &&
    hasExpectedAuthority(snapshotReport.authority) &&
    snapshotReport?.evaluation?.validation?.ok === true &&
    hasValidSnapshotValidation(snapshotReport?.semanticSnapshot?.validation) &&
    snapshotReport?.semanticSnapshot?.provenance?.fixtureDocumentFingerprint === fixtureDocumentFingerprint &&
    Array.isArray(snapshotReport?.evaluation?.results);

  return Object.freeze({
    fixtureCount: fixtureValidation.ok ? fixtureDocument.length : 0,
    fixtureDocumentFingerprint,
    ok: sourceIsValid,
  });
}

function buildInvalidReport({ referenceSetArtifact, sourceValidation }) {
  return Object.freeze({
    authority: cloneAuthority(),
    baseline: null,
    blockers: Object.freeze([
      POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_BLOCKER_IDS.EVALUATION_SOURCE_INVALID,
    ]),
    coverage: Object.freeze([]),
    profile: POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_PROFILE,
    referenceSet: referenceSetArtifact,
    sourceValidation,
    status: Object.freeze({
      automaticRoutingEligibility: false,
      id: POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_STATUS_IDS.INVALID_EVALUATION,
      policyChangeEligibility: false,
    }),
    version: POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_REPORT_VERSION,
  });
}

function buildBlockers({ coverage, metrics, referenceSetArtifact }) {
  const blockers = [];
  const profile = POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_PROFILE;
  if (referenceSetArtifact.status.id !==
      POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS.INDEPENDENTLY_LABELLED) {
    blockers.push(
      POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_BLOCKER_IDS
        .INDEPENDENT_REFERENCE_SET_UNAVAILABLE,
    );
  }
  if (metrics.evaluatedFixtureCount < profile.minimumFixtureCount) {
    blockers.push(POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_BLOCKER_IDS.INSUFFICIENT_FIXTURE_COUNT);
  }
  if (metrics.referenceReviewCount < profile.minimumReferenceReviewCount) {
    blockers.push(POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_BLOCKER_IDS.INSUFFICIENT_REFERENCE_REVIEW_COUNT);
  }
  if (coverage.some((stratum) => !stratum.satisfied)) {
    blockers.push(POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_BLOCKER_IDS.INSUFFICIENT_STRATUM_COVERAGE);
  }
  if (metrics.falsePositiveCount > profile.maximumFalsePositiveCount) {
    blockers.push(POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_BLOCKER_IDS.FALSE_POSITIVE_PRESENT);
  }
  if (metrics.precisionPercent === null || metrics.precisionPercent < profile.minimumPrecisionPercent) {
    blockers.push(POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_BLOCKER_IDS.PRECISION_BELOW_MINIMUM);
  }
  if (metrics.recallPercent === null || metrics.recallPercent < profile.minimumRecallPercent) {
    blockers.push(POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_BLOCKER_IDS.RECALL_BELOW_MINIMUM);
  }
  if (metrics.abstentionRatePercent === null ||
      metrics.abstentionRatePercent > profile.maximumAbstentionRatePercent) {
    blockers.push(POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_BLOCKER_IDS.ABSTENTION_ABOVE_MAXIMUM);
  }
  return Object.freeze(blockers);
}

function projectBaseline(metrics) {
  return Object.freeze({
    abstentionRatePercent: metrics.abstentionRatePercent,
    evaluatedFixtureCount: metrics.evaluatedFixtureCount,
    falseNegativeCount: metrics.falseNegativeCount,
    falsePositiveCount: metrics.falsePositiveCount,
    precisionPercent: metrics.precisionPercent,
    recallPercent: metrics.recallPercent,
    referenceReviewCount: metrics.referenceReviewCount,
  });
}

/**
 * Converts a pinned semantic-snapshot evaluation into a conservative readiness
 * report for a future counter-evidence design review. It never invokes AI,
 * opens a database connection, changes a policy, or authorizes routing.
 */
export function evaluatePolicyCandidateSemanticCounterEvidenceReadiness({
  fixtureDocument,
  referenceSetDocument,
  snapshotReport,
} = {}) {
  const referenceSetArtifact = buildPolicyCandidateSemanticReferenceSetArtifact({
    fixtureDocument,
    referenceSetDocument,
  });
  const sourceValidation = buildSourceValidation(fixtureDocument, snapshotReport);
  if (!sourceValidation.ok || referenceSetArtifact.status.id ===
      POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS.INVALID) {
    return buildInvalidReport({ referenceSetArtifact, sourceValidation });
  }

  const rows = buildRows(fixtureDocument, snapshotReport);
  if (!rows) return buildInvalidReport({ referenceSetArtifact, sourceValidation });

  const metrics = buildPolicyCandidateEvidenceOfflineSignalMetrics({
    rows,
    signalId: POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_PROFILE.semanticSignalId,
  });
  const coverage = buildCoverage(fixtureDocument);
  const blockers = buildBlockers({ coverage, metrics, referenceSetArtifact });
  const ready = blockers.length === 0;

  return Object.freeze({
    authority: cloneAuthority(),
    baseline: projectBaseline(metrics),
    blockers,
    coverage,
    profile: POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_PROFILE,
    referenceSet: referenceSetArtifact,
    sourceValidation,
    status: Object.freeze({
      automaticRoutingEligibility: false,
      id: ready
        ? POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_STATUS_IDS.READY_FOR_HUMAN_REVIEW
        : POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_STATUS_IDS.NOT_READY,
      policyChangeEligibility: false,
    }),
    version: POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_REPORT_VERSION,
  });
}
