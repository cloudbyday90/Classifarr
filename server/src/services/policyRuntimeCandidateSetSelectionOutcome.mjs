/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_RUNTIME_CANDIDATE_SET_SELECTION_MINIMUM_CANDIDATES = 2;
export const POLICY_RUNTIME_CANDIDATE_SET_SELECTION_MAXIMUM_CANDIDATES = 3;

export const POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS = Object.freeze({
  CONFIRMED_CANDIDATE: 'confirmed_candidate',
  CHANGED_TO_CANDIDATE: 'changed_to_candidate',
  CHANGED_OUTSIDE_CANDIDATES: 'changed_outside_candidates',
  ROUTED_NOT_APPLICABLE: 'routed_not_applicable',
});

const ANSWER_ACTION_IDS = Object.freeze({
  CONFIRM_DESTINATION: 'confirm_destination',
  CHANGE_DESTINATION: 'change_destination',
  ROUTE_NOT_APPLICABLE: 'route_not_applicable',
});

function positiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function candidateIds(value) {
  const ids = new Set(
    (Array.isArray(value) ? value : [])
      .map((candidate) => positiveInteger(candidate?.library_id ?? candidate?.libraryId ?? candidate?.id))
      .filter(Boolean),
  );

  return ids.size >= POLICY_RUNTIME_CANDIDATE_SET_SELECTION_MINIMUM_CANDIDATES &&
    ids.size <= POLICY_RUNTIME_CANDIDATE_SET_SELECTION_MAXIMUM_CANDIDATES
    ? ids
    : null;
}

/**
 * Reduces an already server-validated runtime answer to one fixed candidate-set
 * outcome. Candidate and destination identities are consumed in memory only;
 * callers choose the versioned, content-free persistence contract.
 */
export function buildPolicyRuntimeCandidateSetSelectionOutcome({
  answer = null,
  candidateDestinations = [],
  selectedDestinationLibraryId = null,
} = {}) {
  const destinationId = positiveInteger(selectedDestinationLibraryId);
  const candidates = candidateIds(candidateDestinations);
  const actionId = answer?.actionId ?? answer?.action_id;
  if (!destinationId || !candidates || typeof actionId !== 'string') return null;

  let statusId = null;
  if (actionId === ANSWER_ACTION_IDS.CONFIRM_DESTINATION && candidates.has(destinationId)) {
    statusId = POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS.CONFIRMED_CANDIDATE;
  } else if (actionId === ANSWER_ACTION_IDS.CHANGE_DESTINATION) {
    statusId = candidates.has(destinationId)
      ? POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS.CHANGED_TO_CANDIDATE
      : POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS.CHANGED_OUTSIDE_CANDIDATES;
  } else if (actionId === ANSWER_ACTION_IDS.ROUTE_NOT_APPLICABLE) {
    statusId = POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS.ROUTED_NOT_APPLICABLE;
  }

  return statusId ? Object.freeze({ statusId }) : null;
}
