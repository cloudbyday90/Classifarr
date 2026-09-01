/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_CANDIDATE_ADJUDICATION_VERSION = 'policy.candidate_adjudication.v1';
export const POLICY_CANDIDATE_ADJUDICATION_MAXIMUM_CANDIDATES = 3;

export const POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS = Object.freeze({
  READY: 'ready',
  NOT_PROMPT_SELECT: 'not_prompt_select',
  INSUFFICIENT_CANDIDATES: 'insufficient_candidates',
  PROPOSED: 'proposed',
  ABSTAINED: 'abstained',
  RESPONSE_REJECTED: 'response_rejected',
});

export const POLICY_CANDIDATE_ADJUDICATION_SEMANTIC_RETRIEVAL_STATUS_IDS = new Set([
  'available',
  'unavailable',
]);

const PERSISTED_STATUS_IDS = new Set([
  POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS.PROPOSED,
  POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS.ABSTAINED,
  POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS.RESPONSE_REJECTED,
]);

function positiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function boundedString(value, maximumLength = 160) {
  if (typeof value !== 'string') return null;

  const normalized = value.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized && normalized.length <= maximumLength ? normalized : null;
}

function libraryIdentifier(value) {
  return positiveInteger(value?.id ?? value?.library_id);
}

function candidateLibrary(libraries, candidate) {
  const id = libraryIdentifier(candidate);
  return id && Array.isArray(libraries)
    ? libraries.find((library) => libraryIdentifier(library) === id) || null
    : null;
}

function candidateScore(value) {
  const numericValue = Number(value?.score);
  return Number.isFinite(numericValue) && numericValue >= 0 && numericValue <= 100
    ? Math.round(numericValue)
    : null;
}

function invalidContract(reasonCode) {
  return Object.freeze({
    version: POLICY_CANDIDATE_ADJUDICATION_VERSION,
    valid: false,
    reasonCode,
    candidates: Object.freeze([]),
  });
}

/**
 * Defines the complete set of destinations an advisory model may compare.
 * This runtime-only contract is deliberately built from the policy ranking;
 * no provider response can expand it or make a routing decision.
 */
export function buildPolicyCandidateAdjudicationContract({
  policyResult = null,
  libraries = [],
  mediaType = null,
  maximumCandidates = POLICY_CANDIDATE_ADJUDICATION_MAXIMUM_CANDIDATES,
} = {}) {
  if (policyResult?.action !== 'prompt_select') {
    return invalidContract(POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS.NOT_PROMPT_SELECT);
  }

  const limit = Math.min(
    POLICY_CANDIDATE_ADJUDICATION_MAXIMUM_CANDIDATES,
    Math.max(2, Number.isInteger(maximumCandidates) ? maximumCandidates : POLICY_CANDIDATE_ADJUDICATION_MAXIMUM_CANDIDATES),
  );
  const seen = new Set();
  const candidates = (Array.isArray(policyResult?.ranked) ? policyResult.ranked : [])
    .map((rankedCandidate) => {
      const library = candidateLibrary(libraries, rankedCandidate);
      const libraryId = libraryIdentifier(library);
      if (!libraryId || seen.has(libraryId) || library?.is_active === false ||
          (mediaType && library?.media_type && library.media_type !== mediaType)) {
        return null;
      }

      seen.add(libraryId);
      return Object.freeze({
        library,
        libraryId,
        libraryName: boundedString(library.name, 160) || `Library ${libraryId}`,
        mediaType: boundedString(library.media_type, 40),
        policyId: positiveInteger(rankedCandidate?.policy_id),
        policyScore: candidateScore(rankedCandidate),
      });
    })
    .filter(Boolean)
    .slice(0, limit)
    .map((candidate, index) => Object.freeze({ ...candidate, libraryNumber: index + 1 }));

  if (candidates.length < 2) {
    return invalidContract(POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS.INSUFFICIENT_CANDIDATES);
  }

  return Object.freeze({
    version: POLICY_CANDIDATE_ADJUDICATION_VERSION,
    valid: true,
    reasonCode: POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS.READY,
    candidates: Object.freeze(candidates),
  });
}

/**
 * Whitelists the only adjudication facts permitted in classification history.
 * Model reasoning, raw prompt evidence, and arbitrary provider fields are
 * intentionally excluded.
 */
export function buildPolicyCandidateAdjudicationProjection(value = {}) {
  if (value?.version !== POLICY_CANDIDATE_ADJUDICATION_VERSION) return null;

  const statusId = boundedString(value.statusId ?? value.status_id, 80);
  const candidateCount = Number(value.candidateCount ?? value.candidate_count);
  const proposedDestination = value.proposedDestination ?? value.proposed_destination;
  const semanticRetrievalStatusId = boundedString(
    value.semanticRetrievalStatusId ?? value.semantic_retrieval_status_id,
    80,
  );
  const proposedLibraryId = positiveInteger(proposedDestination?.library_id);
  const proposedLibraryName = boundedString(proposedDestination?.library_name, 160);

  if (!PERSISTED_STATUS_IDS.has(statusId) || !Number.isInteger(candidateCount) ||
      candidateCount < 2 || candidateCount > POLICY_CANDIDATE_ADJUDICATION_MAXIMUM_CANDIDATES) {
    return null;
  }

  if (statusId === POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS.PROPOSED &&
      (!proposedLibraryId || !proposedLibraryName)) {
    return null;
  }

  return Object.freeze({
    version: POLICY_CANDIDATE_ADJUDICATION_VERSION,
    status_id: statusId,
    candidate_count: candidateCount,
    proposed_destination: proposedLibraryId && proposedLibraryName
      ? { library_id: proposedLibraryId, library_name: proposedLibraryName }
      : null,
    ...(POLICY_CANDIDATE_ADJUDICATION_SEMANTIC_RETRIEVAL_STATUS_IDS.has(semanticRetrievalStatusId)
      ? { semantic_retrieval_status_id: semanticRetrievalStatusId }
      : {}),
  });
}
