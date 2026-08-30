/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocument,
} from './policyCandidateEvidenceOfflineEvaluationContract.mjs';
import {
  createPolicyCandidateSemanticSnapshotFingerprint,
} from './policyCandidateSemanticSnapshotFingerprint.mjs';
import {
  validatePolicyCandidateSemanticSnapshotDocument,
} from './policyCandidateSemanticSnapshotContract.mjs';
import {
  validatePolicyCandidateSemanticSnapshotManifest,
} from './policyCandidateSemanticSnapshotManifestContract.mjs';
import {
  scorePolicyCandidateSemanticSnapshot,
} from './policyCandidateSemanticSnapshotScoring.mjs';

export const POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_ADAPTER_RISK_IDS = Object.freeze({
  FIXTURE_DOCUMENT_FINGERPRINT_MISMATCH: 'fixture_document_fingerprint_mismatch',
  MISSING_FIXTURE_SNAPSHOT: 'missing_fixture_snapshot',
  SNAPSHOT_DOCUMENT_FINGERPRINT_MISMATCH: 'snapshot_document_fingerprint_mismatch',
  SNAPSHOT_FIXTURE_BINDING_MISMATCH: 'snapshot_fixture_binding_mismatch',
  UNEXPECTED_SNAPSHOT_FIXTURE: 'unexpected_snapshot_fixture',
});

function buildIssue(riskId, path, message) {
  return Object.freeze({ riskId, path, message });
}

function projectValidation(validation) {
  return Object.freeze({
    issueCount: Array.isArray(validation?.issues) ? validation.issues.length : 0,
    ok: validation?.ok === true,
    riskIds: Object.freeze([...new Set(
      (Array.isArray(validation?.issues) ? validation.issues : [])
        .map((issue) => issue?.riskId)
        .filter((riskId) => typeof riskId === 'string'),
    )].sort()),
  });
}

function buildProvenance({ fixtureDocument, snapshotDocument, fixtureFingerprint, snapshotFingerprint }) {
  return Object.freeze({
    embeddingSpaceId: snapshotDocument.embeddingSpaceId,
    fixtureCount: fixtureDocument.length,
    fixtureDocumentFingerprint: fixtureFingerprint,
    snapshotCount: snapshotDocument.snapshots.length,
    snapshotDocumentFingerprint: snapshotFingerprint,
    snapshotDocumentVersion: snapshotDocument.version,
    snapshotSetId: snapshotDocument.snapshotSetId,
  });
}

function validateDocumentBinding({ fixtureDocument, snapshotDocument, manifest }) {
  const issues = [];
  const fixtureFingerprint = createPolicyCandidateSemanticSnapshotFingerprint(fixtureDocument);
  const snapshotFingerprint = createPolicyCandidateSemanticSnapshotFingerprint(snapshotDocument);

  if (manifest.fixtureDocumentFingerprint !== fixtureFingerprint) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_ADAPTER_RISK_IDS.FIXTURE_DOCUMENT_FINGERPRINT_MISMATCH,
      'manifest.fixtureDocumentFingerprint',
      'The fixture document does not match the manifest-pinned content address.',
    ));
  }
  if (manifest.snapshotDocumentFingerprint !== snapshotFingerprint) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_ADAPTER_RISK_IDS.SNAPSHOT_DOCUMENT_FINGERPRINT_MISMATCH,
      'manifest.snapshotDocumentFingerprint',
      'The snapshot document does not match the manifest-pinned content address.',
    ));
  }

  const snapshotsByFixtureId = new Map(snapshotDocument.snapshots.map((snapshot) => [
    snapshot.fixtureId,
    snapshot,
  ]));
  const fixtureIds = new Set(fixtureDocument.map((fixture) => fixture.id));

  for (const fixture of fixtureDocument) {
    const snapshot = snapshotsByFixtureId.get(fixture.id);
    if (!snapshot) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_ADAPTER_RISK_IDS.MISSING_FIXTURE_SNAPSHOT,
        `fixtures.${fixture.id}`,
        'Every reviewed fixture must have exactly one semantic snapshot.',
      ));
    } else if (snapshot.id !== fixture.observations.semanticSnapshotId) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_ADAPTER_RISK_IDS.SNAPSHOT_FIXTURE_BINDING_MISMATCH,
        `fixtures.${fixture.id}.observations.semanticSnapshotId`,
        'The fixture does not reference its committed semantic snapshot.',
      ));
    }
  }
  for (const snapshot of snapshotDocument.snapshots) {
    if (!fixtureIds.has(snapshot.fixtureId)) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_ADAPTER_RISK_IDS.UNEXPECTED_SNAPSHOT_FIXTURE,
        `snapshots.${snapshot.id}.fixtureId`,
        'Every semantic snapshot must correspond to a reviewed fixture.',
      ));
    }
  }

  return {
    fixtureFingerprint,
    issues,
    snapshotFingerprint,
    snapshotsByFixtureId,
  };
}

/**
 * Adapts a fixed local snapshot into only the three semantic signal IDs used
 * by the offline evaluator. It does not call a model or database and does not
 * expose raw embeddings, fixture names, candidates, media, or retrieval text.
 */
export function buildPolicyCandidateSemanticSnapshotSignals({
  fixtureDocument,
  manifest,
  snapshotDocument,
} = {}) {
  const fixtureValidation = validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocument(fixtureDocument);
  const snapshotValidation = validatePolicyCandidateSemanticSnapshotDocument(snapshotDocument);
  const manifestValidation = validatePolicyCandidateSemanticSnapshotManifest(manifest);
  const validationIssues = [
    ...fixtureValidation.issues,
    ...snapshotValidation.issues,
    ...manifestValidation.issues,
  ];

  if (validationIssues.length > 0) {
    return Object.freeze({
      ok: false,
      provenance: null,
      signals: Object.freeze([]),
      validation: Object.freeze({
        fixture: projectValidation(fixtureValidation),
        manifest: projectValidation(manifestValidation),
        semanticSnapshot: projectValidation(snapshotValidation),
      }),
    });
  }

  const binding = validateDocumentBinding({ fixtureDocument, manifest, snapshotDocument });
  if (binding.issues.length > 0) {
    return Object.freeze({
      ok: false,
      provenance: null,
      signals: Object.freeze([]),
      validation: Object.freeze({
        binding: projectValidation({ ok: false, issues: binding.issues }),
        fixture: projectValidation(fixtureValidation),
        manifest: projectValidation(manifestValidation),
        semanticSnapshot: projectValidation(snapshotValidation),
      }),
    });
  }

  return Object.freeze({
    ok: true,
    provenance: buildProvenance({
      fixtureDocument,
      fixtureFingerprint: binding.fixtureFingerprint,
      snapshotDocument,
      snapshotFingerprint: binding.snapshotFingerprint,
    }),
    signals: Object.freeze(fixtureDocument.map((fixture) => Object.freeze({
      fixtureId: fixture.id,
      semanticRetrievalSignalId: scorePolicyCandidateSemanticSnapshot(
        binding.snapshotsByFixtureId.get(fixture.id),
      ),
    }))),
    validation: Object.freeze({
      binding: projectValidation({ ok: true, issues: [] }),
      fixture: projectValidation(fixtureValidation),
      manifest: projectValidation(manifestValidation),
      semanticSnapshot: projectValidation(snapshotValidation),
    }),
  });
}
