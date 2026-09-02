/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  evaluatePolicyCandidateSemanticCounterEvidenceReadiness,
} from './policyCandidateSemanticCounterEvidenceReadiness.mjs';
import {
  evaluatePolicyCandidateSemanticSnapshotOfflineFixtureDocument,
} from './policyCandidateSemanticSnapshotOfflineEvaluation.mjs';

/**
 * Evaluates a fixed semantic-study bundle entirely in memory. This service
 * does not perform I/O, call AI/RAG, retain study inputs, or grant routing,
 * learning, policy-change, retry, or operator-workflow authority.
 */
export function evaluatePolicyCandidateSemanticCounterEvidenceStudy({
  fixtureDocument,
  manifest,
  referenceSetDocument,
  snapshotDocument,
} = {}) {
  const snapshotReport = evaluatePolicyCandidateSemanticSnapshotOfflineFixtureDocument({
    fixtureDocument,
    manifest,
    snapshotDocument,
  });
  return evaluatePolicyCandidateSemanticCounterEvidenceReadiness({
    fixtureDocument,
    referenceSetDocument,
    snapshotReport,
  });
}
