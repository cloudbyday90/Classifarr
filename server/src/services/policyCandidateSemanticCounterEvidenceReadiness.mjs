/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { isHeldOutSemanticStudyProvenance } from './heldOutSemanticStudyProvenance.mjs';
import {
  buildPolicyCandidateEvidenceOfflineSignalMetrics,
} from './policyCandidateEvidenceOfflineEvaluationMetrics.mjs';
import {
  buildPolicyCandidateSemanticEvaluationSource,
} from './policyCandidateSemanticEvaluationSource.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS,
} from './policyCandidateSemanticReferenceSetArtifact.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_AUTHORITY,
  POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_BLOCKER_IDS,
  POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_PROFILE,
  POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_REPORT_VERSION,
  POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_STATUS_IDS,
} from './policyCandidateSemanticCounterEvidenceReadinessContract.mjs';

function cloneAuthority() {
  return Object.freeze({
    ...POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_AUTHORITY,
    automaticActions: Object.freeze({
      ...POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_AUTHORITY.automaticActions,
    }),
  });
}

function countRowsWithTag(rows, tagId) {
  return rows.filter((row) => row.tags.includes(tagId)).length;
}

function buildCoverage(rows) {
  return Object.freeze(POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_PROFILE.requiredStrata.map((stratum) => {
    const fixtureCount = countRowsWithTag(rows, stratum.tagId);
    return Object.freeze({
      fixtureCount,
      minimumFixtureCount: stratum.minimumFixtureCount,
      satisfied: fixtureCount >= stratum.minimumFixtureCount,
      tagId: stratum.tagId,
    });
  }));
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

function buildBlockers({ coverage, metrics, referenceSetArtifact, provenance }) {
  const blockers = [];
  if (provenance?.sourceId === 'current_inventory_relevance' &&
      !isHeldOutSemanticStudyProvenance(provenance.studyProvenance, provenance.snapshotCount)) {
    blockers.push(POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_BLOCKER_IDS.HELD_OUT_PROVENANCE_UNAVAILABLE);
  }
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
  const source = buildPolicyCandidateSemanticEvaluationSource({
    fixtureDocument,
    referenceSetDocument,
    signalId: POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_PROFILE.semanticSignalId,
    snapshotReport,
  });
  if (!source.ok) {
    return buildInvalidReport({
      referenceSetArtifact: source.referenceSet,
      sourceValidation: source.sourceValidation,
    });
  }

  const metrics = buildPolicyCandidateEvidenceOfflineSignalMetrics({
    rows: source.rows,
    signalId: POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_PROFILE.semanticSignalId,
  });
  const coverage = buildCoverage(source.rows);
  const blockers = buildBlockers({
    coverage, metrics, referenceSetArtifact: source.referenceSet,
    provenance: source.provenance,
  });
  const ready = blockers.length === 0;

  return Object.freeze({
    authority: cloneAuthority(),
    baseline: projectBaseline(metrics),
    blockers,
    coverage,
    profile: POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_PROFILE,
    referenceSet: source.referenceSet,
    sourceValidation: source.sourceValidation,
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
