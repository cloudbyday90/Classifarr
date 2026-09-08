/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  validatePolicyCandidateCurrentInventorySemanticStudySnapshotDocument,
} from './policyCandidateCurrentInventorySemanticStudySnapshotContract.mjs';
import {
  createPolicyCandidateSemanticSnapshotFingerprint,
} from './policyCandidateSemanticSnapshotFingerprint.mjs';

export const HELD_OUT_SEMANTIC_STUDY_BUNDLE_VERSION =
  'policy.held_out_semantic_study_bundle.v1';

function fixtureForSelection(selection, snapshot) {
  return Object.freeze({
    id: selection.fixtureId,
    name: selection.fixtureId,
    observations: Object.freeze({
      candidateSetSelectionStatusId: 'routed_not_applicable',
      contrastiveStatusId: 'not_applicable',
      semanticRetrievalSignalId: 'abstain',
      semanticSnapshotId: snapshot.id,
    }),
    reference: Object.freeze({ decisionId: 'abstain' }),
    tags: Object.freeze(['broad-policy', selection.stratum]),
    version: 'policy.candidate_evidence_offline_evaluation_fixture.v1',
  });
}

/**
 * Builds the content-free half of a future independently-labelled study. The
 * placeholder reference decision is reproducibility-only and is replaced by a
 * separately validated independent label artifact before readiness can pass.
 */
export function buildHeldOutSemanticStudyBundle({ selected, snapshotDocument } = {}) {
  const snapshotValidation = validatePolicyCandidateCurrentInventorySemanticStudySnapshotDocument(snapshotDocument);
  if (!snapshotValidation.ok || !Array.isArray(selected) || selected.length !== snapshotDocument?.snapshots?.length) {
    return null;
  }

  const selectionByFixtureId = new Map(selected.map((entry) => [entry?.fixtureId, entry]));
  if (selectionByFixtureId.size !== selected.length ||
      snapshotDocument.snapshots.some((snapshot) => !selectionByFixtureId.has(snapshot.fixtureId))) {
    return null;
  }

  const fixtureDocument = Object.freeze(snapshotDocument.snapshots.map((snapshot) => {
    const selection = selectionByFixtureId.get(snapshot.fixtureId);
    if (!selection || selection.snapshotId !== snapshot.id) return null;
    return fixtureForSelection(selection, snapshot);
  }));
  if (fixtureDocument.includes(null)) return null;

  return Object.freeze({
    fixtureDocument,
    manifest: Object.freeze({
      fixtureDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(fixtureDocument),
      snapshotDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(snapshotDocument),
      version: 'policy.candidate_semantic_snapshot_manifest.v1',
    }),
    snapshotDocument,
    version: HELD_OUT_SEMANTIC_STUDY_BUNDLE_VERSION,
  });
}
