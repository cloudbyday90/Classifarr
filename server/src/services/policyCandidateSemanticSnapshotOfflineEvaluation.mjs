/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  evaluatePolicyCandidateEvidenceOfflineFixtureDocument,
} from './policyCandidateEvidenceOfflineEvaluation.mjs';
import {
  buildPolicyCandidateSemanticSnapshotSignals,
} from './policyCandidateSemanticSnapshotAdapter.mjs';

export const POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_OFFLINE_EVALUATION_REPORT_VERSION =
  'policy.candidate_semantic_snapshot_offline_evaluation_report.v1';

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
    snapshotAccess: 'validated_fixed_input_read_only',
  });
}

function buildEvaluationDocument(fixtureDocument, signals) {
  const signalsByFixtureId = new Map(signals.map((signal) => [
    signal.fixtureId,
    signal.semanticRetrievalSignalId,
  ]));

  return fixtureDocument.map((fixture) => ({
    ...fixture,
    observations: {
      ...fixture.observations,
      semanticRetrievalSignalId: signalsByFixtureId.get(fixture.id),
    },
  }));
}

function buildSignalExpectationSummary(fixtureDocument, signals) {
  const signalsByFixtureId = new Map(signals.map((signal) => [
    signal.fixtureId,
    signal.semanticRetrievalSignalId,
  ]));
  const expectedSignalMatchCount = fixtureDocument.filter((fixture) => (
    fixture.observations.semanticRetrievalSignalId === signalsByFixtureId.get(fixture.id)
  )).length;

  return Object.freeze({
    expectedSignalMatchCount,
    expectedSignalMismatchCount: fixtureDocument.length - expectedSignalMatchCount,
  });
}

/**
 * Runs the existing offline metrics over status-only output from the pinned
 * snapshot adapter. Invalid artifacts produce an inert, non-actionable report.
 */
export function evaluatePolicyCandidateSemanticSnapshotOfflineFixtureDocument({
  fixtureDocument,
  manifest,
  snapshotDocument,
} = {}) {
  const adapter = buildPolicyCandidateSemanticSnapshotSignals({
    fixtureDocument,
    manifest,
    snapshotDocument,
  });

  if (!adapter.ok) {
    return Object.freeze({
      authority: buildAuthority(),
      evaluation: null,
      semanticSnapshot: Object.freeze({
        provenance: null,
        validation: adapter.validation,
      }),
      version: POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_OFFLINE_EVALUATION_REPORT_VERSION,
    });
  }

  const evaluation = evaluatePolicyCandidateEvidenceOfflineFixtureDocument(
    buildEvaluationDocument(fixtureDocument, adapter.signals),
  );

  return Object.freeze({
    authority: buildAuthority(),
    evaluation,
    semanticSnapshot: Object.freeze({
      provenance: adapter.provenance,
      signalExpectation: buildSignalExpectationSummary(fixtureDocument, adapter.signals),
      validation: adapter.validation,
    }),
    version: POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_OFFLINE_EVALUATION_REPORT_VERSION,
  });
}
