/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_MAXIMUM_CANDIDATES,
} from './currentLibraryCandidateRetrievalContract.mjs';
import {
  buildCurrentLibraryCandidateRetrievalTelemetryProjection,
} from './currentLibraryCandidateRetrievalTelemetry.mjs';

export const CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_OUTCOME_ATTRIBUTION_VERSION =
  'current_library.candidate_retrieval_outcome_attribution.v1';

export const CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_OUTCOME_ATTRIBUTION_STATUS_IDS = Object.freeze({
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

const ATTRIBUTION_STATUS_IDS = new Set(
  Object.values(CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_OUTCOME_ATTRIBUTION_STATUS_IDS),
);

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

  return ids.size >= 2 && ids.size <= CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_MAXIMUM_CANDIDATES
    ? ids
    : null;
}

function hasCurrentLibraryRetrievalTelemetry(classificationDetails) {
  return Boolean(buildCurrentLibraryCandidateRetrievalTelemetryProjection(
    classificationDetails?.current_library_candidate_retrieval_telemetry,
  ));
}

/**
 * Reduces a server-validated operator action to a fixed candidate-set outcome
 * status. Candidate and destination identities are used only in memory and
 * never appear in the returned projection.
 */
export function buildCurrentLibraryCandidateRetrievalOutcomeAttribution({
  classificationDetails = null,
  answer = null,
  candidateDestinations = [],
  selectedDestinationLibraryId = null,
} = {}) {
  if (!hasCurrentLibraryRetrievalTelemetry(classificationDetails)) return null;

  const destinationId = positiveInteger(selectedDestinationLibraryId);
  const candidates = candidateIds(candidateDestinations);
  const actionId = answer?.actionId ?? answer?.action_id;
  if (!destinationId || !candidates || typeof actionId !== 'string') return null;

  let statusId = null;
  if (actionId === ANSWER_ACTION_IDS.CONFIRM_DESTINATION && candidates.has(destinationId)) {
    statusId = CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_OUTCOME_ATTRIBUTION_STATUS_IDS.CONFIRMED_CANDIDATE;
  } else if (actionId === ANSWER_ACTION_IDS.CHANGE_DESTINATION) {
    statusId = candidates.has(destinationId)
      ? CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_OUTCOME_ATTRIBUTION_STATUS_IDS.CHANGED_TO_CANDIDATE
      : CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_OUTCOME_ATTRIBUTION_STATUS_IDS.CHANGED_OUTSIDE_CANDIDATES;
  } else if (actionId === ANSWER_ACTION_IDS.ROUTE_NOT_APPLICABLE) {
    statusId = CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_OUTCOME_ATTRIBUTION_STATUS_IDS.ROUTED_NOT_APPLICABLE;
  }

  return statusId
    ? Object.freeze({
      version: CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_OUTCOME_ATTRIBUTION_VERSION,
      statusId,
    })
    : null;
}

/**
 * Rebuilds the persisted object from an allow-listed version/status pair. This
 * rejects raw client, destination, provider, and model fields at the write
 * boundary.
 */
export function buildCurrentLibraryCandidateRetrievalOutcomeAttributionProjection(value = {}) {
  const statusId = value?.statusId ?? value?.status_id;
  if (value?.version !== CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_OUTCOME_ATTRIBUTION_VERSION ||
      !ATTRIBUTION_STATUS_IDS.has(statusId)) {
    return null;
  }

  return Object.freeze({
    version: CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_OUTCOME_ATTRIBUTION_VERSION,
    status_id: statusId,
  });
}
