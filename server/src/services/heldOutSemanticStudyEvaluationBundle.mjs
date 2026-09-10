/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  getHeldOutSemanticStudyReviewerPacketBinding,
} from './heldOutSemanticStudyReviewerSubmissionTemplate.mjs';
import {
  buildPolicyCandidateSemanticSnapshotSignals,
} from './policyCandidateSemanticSnapshotAdapter.mjs';

export const HELD_OUT_SEMANTIC_STUDY_EVALUATION_BUNDLE_VERSION =
  'policy.held_out_semantic_study_evaluation_bundle.v1';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function cloneJson(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function hasExactFixtureSet(fixtureDocument, fixtureIds) {
  if (!Array.isArray(fixtureDocument) || fixtureDocument.length !== fixtureIds.length) return false;
  const expectedFixtureIds = new Set(fixtureIds);
  for (const fixture of fixtureDocument) {
    if (!expectedFixtureIds.delete(fixture?.id)) return false;
  }
  return expectedFixtureIds.size === 0;
}

/**
 * Projects the redacted snapshot, manifest, and fixture contract that were
 * created beside a private reviewer packet. It proves that the artifacts match
 * the packet's opaque fixture binding and deliberately omits every packet,
 * media, policy, retrieval-context, and reviewer field. The bundle is inert:
 * it has no network, database, AI/RAG, learning, policy, or routing authority.
 */
export function buildHeldOutSemanticStudyEvaluationBundle({ bundle, packet } = {}) {
  const packetBinding = getHeldOutSemanticStudyReviewerPacketBinding({ packet });
  const fixtureDocument = bundle?.fixtureDocument;
  const manifest = bundle?.manifest;
  const snapshotDocument = bundle?.snapshotDocument;
  const signals = buildPolicyCandidateSemanticSnapshotSignals({
    fixtureDocument,
    manifest,
    snapshotDocument,
  });
  if (!packetBinding || !signals.ok ||
      signals.provenance?.fixtureDocumentFingerprint !== packetBinding.fixtureDocumentFingerprint ||
      !hasExactFixtureSet(fixtureDocument, packetBinding.fixtureIds)) {
    return null;
  }

  const projected = cloneJson({
    fixtureDocument,
    manifest,
    snapshotDocument,
    version: HELD_OUT_SEMANTIC_STUDY_EVALUATION_BUNDLE_VERSION,
  });
  return projected ? deepFreeze(projected) : null;
}
