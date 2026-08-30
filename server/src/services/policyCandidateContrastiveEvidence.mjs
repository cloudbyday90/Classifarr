/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_CONTRACT_STATUS_IDS,
} from './policyCandidateContrastiveRetrievalContract.mjs';
import {
  POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_STATUS_IDS,
  POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_VERSION,
} from './policyCandidateContrastiveRetriever.mjs';

export const POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_VERSION =
  'policy.candidate_contrastive_evidence.v1';
export const POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_PROVENANCE_ID =
  'exact_tmdb_current_library_inventory';

export const POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS = Object.freeze({
  NOT_APPLICABLE: 'not_applicable',
  IDENTITY_UNVERIFIED: 'identity_unverified',
  RETRIEVAL_UNAVAILABLE: 'retrieval_unavailable',
  LEADING_IDENTITY_MATCH: 'leading_identity_match',
  ALTERNATIVE_IDENTITY_MATCH: 'alternative_identity_match',
  SHARED_IDENTITY_MATCH: 'shared_identity_match',
  NO_CANDIDATE_IDENTITY_MATCH: 'no_candidate_identity_match',
});

const VALID_STATUS_IDS = new Set(Object.values(POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS));

function result(statusId) {
  return Object.freeze({
    version: POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_VERSION,
    provenance_id: POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_PROVENANCE_ID,
    status_id: statusId,
  });
}

/**
 * Converts an exact, candidate-scoped inventory lookup into a content-free
 * contrastive fact. Inventory presence supports an existing association; it
 * never proves that a new item should route there or overrides policy intent.
 */
export function buildPolicyCandidateContrastiveEvidence({
  contract = null,
  retrieval = null,
} = {}) {
  if (contract?.valid !== true) {
    return result(contract?.statusId ===
      POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_CONTRACT_STATUS_IDS.IDENTITY_UNVERIFIED
      ? POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS.IDENTITY_UNVERIFIED
      : POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS.NOT_APPLICABLE);
  }
  if (
    retrieval?.version !== POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_VERSION ||
    retrieval?.statusId !== POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_STATUS_IDS.AVAILABLE
  ) {
    return result(POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS.RETRIEVAL_UNAVAILABLE);
  }

  const candidateIds = new Set(contract.candidates.map((candidate) => candidate.libraryId));
  const matchedIds = new Set(
    (Array.isArray(retrieval.matchedLibraryIds) ? retrieval.matchedLibraryIds : [])
      .filter((libraryId) => candidateIds.has(libraryId)),
  );
  const leadingMatches = matchedIds.has(contract.candidates[0]?.libraryId);
  const alternativeMatches = contract.candidates
    .slice(1)
    .some((candidate) => matchedIds.has(candidate.libraryId));

  if (leadingMatches && alternativeMatches) {
    return result(POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS.SHARED_IDENTITY_MATCH);
  }
  if (leadingMatches) {
    return result(POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS.LEADING_IDENTITY_MATCH);
  }
  if (alternativeMatches) {
    return result(POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS.ALTERNATIVE_IDENTITY_MATCH);
  }
  return result(POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS.NO_CANDIDATE_IDENTITY_MATCH);
}

/**
 * Retains only the fixed, low-cardinality result intended for classification
 * history and the pending-decision UI. No ID, candidate membership, catalog
 * title, provider data, or retrieval text can cross this boundary.
 */
export function buildPolicyCandidateContrastiveEvidenceProjection(value = {}) {
  if (
    value?.version !== POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_VERSION ||
    value?.provenance_id !== POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_PROVENANCE_ID ||
    !VALID_STATUS_IDS.has(value?.status_id)
  ) {
    return null;
  }

  return result(value.status_id);
}
