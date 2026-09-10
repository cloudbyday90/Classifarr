/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS,
  validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocument,
} from './policyCandidateEvidenceOfflineEvaluationContract.mjs';
import {
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SIGNAL_IDS,
} from './policyCandidateEvidenceOfflineEvaluationSignalMapping.mjs';
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

const VALID_DECISION_IDS = new Set(Object.values(
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS,
));

function hasExpectedAuthority(authority) {
  return authority?.scope === 'offline_evaluation_only' &&
    authority?.operatorWorkflowAdmission === false &&
    authority?.snapshotAccess === 'validated_fixed_input_read_only' &&
    ['aiInvocation', 'learning', 'policyChange', 'retry', 'routing'].every((action) => (
      authority?.automaticActions?.[action] === false
    ));
}

function hasValidSnapshotValidation(validation) {
  return ['binding', 'fixture', 'manifest', 'semanticSnapshot'].every((key) => (
    validation?.[key]?.ok === true && validation[key].issueCount === 0
  ));
}

function buildSourceValidation(fixtureDocument, snapshotReport) {
  const fixtureValidation = validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocument(fixtureDocument);
  const fixtureDocumentFingerprint = fixtureValidation.ok
    ? createPolicyCandidateSemanticSnapshotFingerprint(fixtureDocument)
    : null;
  const ok = fixtureValidation.ok &&
    snapshotReport?.version === POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_OFFLINE_EVALUATION_REPORT_VERSION &&
    hasExpectedAuthority(snapshotReport.authority) &&
    snapshotReport?.evaluation?.validation?.ok === true &&
    hasValidSnapshotValidation(snapshotReport?.semanticSnapshot?.validation) &&
    snapshotReport?.semanticSnapshot?.provenance?.fixtureDocumentFingerprint === fixtureDocumentFingerprint &&
    Array.isArray(snapshotReport?.evaluation?.results);

  return Object.freeze({
    fixtureCount: fixtureValidation.ok ? fixtureDocument.length : 0,
    fixtureDocumentFingerprint,
    ok,
  });
}

function buildReferenceDecisions(fixtureDocument, referenceSetDocument, referenceSetArtifact) {
  if (referenceSetArtifact.status.id ===
      POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS.INDEPENDENTLY_LABELLED) {
    const labelsByFixtureId = new Map(referenceSetDocument.labels.map((label) => [
      label.fixtureId,
      label.referenceDecisionId,
    ]));
    if (labelsByFixtureId.size !== fixtureDocument.length ||
        !fixtureDocument.every((fixture) => VALID_DECISION_IDS.has(labelsByFixtureId.get(fixture.id)))) {
      return null;
    }
    return labelsByFixtureId;
  }

  return new Map(fixtureDocument.map((fixture) => [fixture.id, fixture.reference.decisionId]));
}

function buildRows({ fixtureDocument, referenceDecisions, signalId, snapshotReport }) {
  const resultsByFixtureId = new Map(snapshotReport.evaluation.results.map((result) => [
    result?.fixtureId,
    result,
  ]));
  if (resultsByFixtureId.size !== fixtureDocument.length || !referenceDecisions) return null;

  const rows = [];
  for (const fixture of fixtureDocument) {
    const result = resultsByFixtureId.get(fixture.id);
    const referenceDecisionId = referenceDecisions.get(fixture.id);
    const signalDecisionId = result?.signalDecisions?.[signalId];
    if (!result || !VALID_DECISION_IDS.has(referenceDecisionId) ||
        !VALID_DECISION_IDS.has(signalDecisionId)) {
      return null;
    }
    rows.push(Object.freeze({
      referenceDecisionId,
      signalDecisionId,
      tags: Object.freeze([...fixture.tags]),
    }));
  }
  return Object.freeze(rows);
}

/**
 * Binds a validated fixed semantic evaluation to reference decisions while
 * keeping fixture IDs, names, snapshots, embeddings, and library context
 * inside this service boundary. Consumers receive only aggregate-ready rows.
 */
export function buildPolicyCandidateSemanticEvaluationSource({
  fixtureDocument,
  referenceSetDocument,
  signalId = POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SIGNAL_IDS.SEMANTIC_RETRIEVAL_PROPOSAL,
  snapshotReport,
} = {}) {
  const referenceSet = buildPolicyCandidateSemanticReferenceSetArtifact({
    fixtureDocument,
    referenceSetDocument,
  });
  const sourceValidation = buildSourceValidation(fixtureDocument, snapshotReport);
  if (!sourceValidation.ok || referenceSet.status.id ===
      POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS.INVALID ||
      typeof signalId !== 'string') {
    return Object.freeze({
      ok: false,
      provenance: null,
      referenceSet,
      rows: Object.freeze([]),
      sourceValidation,
    });
  }

  const rows = buildRows({
    fixtureDocument,
    referenceDecisions: buildReferenceDecisions(fixtureDocument, referenceSetDocument, referenceSet),
    signalId,
    snapshotReport,
  });
  return Object.freeze({
    ok: rows !== null,
    provenance: rows === null ? null : snapshotReport.semanticSnapshot.provenance,
    referenceSet,
    rows: rows || Object.freeze([]),
    sourceValidation,
  });
}
