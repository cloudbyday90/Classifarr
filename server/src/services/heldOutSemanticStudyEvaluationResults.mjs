/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildPolicyCandidateSemanticEvaluationResultsSummary,
} from './policyCandidateSemanticEvaluationResultsSummary.mjs';
import {
  evaluatePolicyCandidateSemanticSnapshotOfflineFixtureDocument,
} from './policyCandidateSemanticSnapshotOfflineEvaluation.mjs';
import {
  isHeldOutSemanticStudyEvaluationBundleShape,
} from './heldOutSemanticStudyEvaluationBundleShape.mjs';

function buildInvalidSourceSummary(referenceSetDocument) {
  return buildPolicyCandidateSemanticEvaluationResultsSummary({
    fixtureDocument: null,
    referenceSetDocument,
    snapshotReport: null,
  });
}

/**
 * Evaluates only the fingerprint-pinned, redacted companion produced beside a
 * private reviewer packet. It emits the existing aggregate-only results
 * contract and fails closed for an altered or unsupported bundle. It does not
 * read a packet, invoke AI/RAG, learn, alter policy, retry, or route media.
 */
export function buildHeldOutSemanticStudyEvaluationResults({
  evaluationBundle,
  referenceSetDocument,
} = {}) {
  if (!isHeldOutSemanticStudyEvaluationBundleShape(evaluationBundle)) {
    return buildInvalidSourceSummary(referenceSetDocument);
  }

  const snapshotReport = evaluatePolicyCandidateSemanticSnapshotOfflineFixtureDocument({
    fixtureDocument: evaluationBundle.fixtureDocument,
    manifest: evaluationBundle.manifest,
    snapshotDocument: evaluationBundle.snapshotDocument,
  });
  return buildPolicyCandidateSemanticEvaluationResultsSummary({
    fixtureDocument: evaluationBundle.fixtureDocument,
    referenceSetDocument,
    snapshotReport,
  });
}
