/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildCurrentLibraryCandidateRetrievalTelemetryProjection,
} from './currentLibraryCandidateRetrievalTelemetry.mjs';
import {
  POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS,
  buildPolicyRuntimeCandidateSetSelectionOutcome,
} from './policyRuntimeCandidateSetSelectionOutcome.mjs';

export const CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_OUTCOME_ATTRIBUTION_VERSION =
  'current_library.candidate_retrieval_outcome_attribution.v1';

export const CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_OUTCOME_ATTRIBUTION_STATUS_IDS =
  POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS;

const ATTRIBUTION_STATUS_IDS = new Set(
  Object.values(CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_OUTCOME_ATTRIBUTION_STATUS_IDS),
);

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

  const selectionOutcome = buildPolicyRuntimeCandidateSetSelectionOutcome({
    answer,
    candidateDestinations,
    selectedDestinationLibraryId,
  });

  return selectionOutcome
    ? Object.freeze({
      version: CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_OUTCOME_ATTRIBUTION_VERSION,
      statusId: selectionOutcome.statusId,
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
