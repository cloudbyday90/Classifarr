/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_STATUS_IDS,
  CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_VERSION,
} from './currentLibraryCandidateSemanticRetrievalContract.mjs';
import {
  POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_STATUS_IDS,
  POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_VERSION,
  validatePolicyCandidateCurrentInventorySemanticStudySnapshot,
} from './policyCandidateCurrentInventorySemanticStudySnapshotContract.mjs';

function boundedRelevance(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : 0;
}

function candidateCount(contract) {
  const candidates = Array.isArray(contract?.candidates) ? contract.candidates : [];
  return contract?.valid === true && candidates.length >= 2 && candidates.length <= 3
    ? candidates.length
    : null;
}

function candidateRelevance(retrieval, libraryId) {
  const candidate = (Array.isArray(retrieval?.candidates) ? retrieval.candidates : [])
    .find((entry) => Number(entry?.libraryId) === Number(libraryId));
  return boundedRelevance(candidate?.topRelevance);
}

/**
 * Reduces one policy-owned current-library retrieval to the only values an
 * external, access-controlled study needs: leading and strongest-alternative
 * relevance. It does not store or return library identities, item identities,
 * titles, descriptions, prompts, vectors, provider data, or routing state.
 */
export function buildPolicyCandidateCurrentInventorySemanticStudySnapshot({
  contract = null,
  fixtureId = null,
  retrieval = null,
  snapshotId = null,
} = {}) {
  const count = candidateCount(contract);
  if (!count || typeof fixtureId !== 'string' || typeof snapshotId !== 'string') return null;

  const candidates = contract.candidates;
  const retrievalAvailable = retrieval?.version === CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_VERSION &&
    retrieval?.statusId === CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_STATUS_IDS.AVAILABLE;
  const leadingRelevance = retrievalAvailable
    ? candidateRelevance(retrieval, candidates[0].libraryId)
    : null;
  const alternativeRelevance = retrievalAvailable
    ? Math.max(...candidates.slice(1).map((candidate) => candidateRelevance(retrieval, candidate.libraryId)))
    : null;

  const snapshot = {
    alternativeRelevance,
    candidateCount: count,
    fixtureId,
    id: snapshotId,
    leadingRelevance,
    retrievalStatusId: retrievalAvailable
      ? POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_STATUS_IDS.AVAILABLE
      : POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_STATUS_IDS.UNAVAILABLE,
    version: POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_VERSION,
  };
  return validatePolicyCandidateCurrentInventorySemanticStudySnapshot(snapshot).ok
    ? Object.freeze(snapshot)
    : null;
}
