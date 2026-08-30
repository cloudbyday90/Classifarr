/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS,
  buildPolicyCandidateContrastiveEvidenceProjection,
} from './policyCandidateContrastiveEvidence.mjs';
import {
  POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS,
  buildPolicyRuntimeCandidateSetSelectionOutcome,
} from './policyRuntimeCandidateSetSelectionOutcome.mjs';

export const POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_ATTRIBUTION_VERSION =
  'policy.candidate_contrastive_outcome_attribution.v1';

const TRACKED_CONTRASTIVE_STATUS_IDS = new Set(
  Object.values(POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS)
    .filter((statusId) => statusId !== POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS.NOT_APPLICABLE),
);
const SELECTION_STATUS_IDS = new Set(
  Object.values(POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS),
);

/**
 * Records the contrastive status that was already server-derived for a pending
 * decision alongside the server-derived candidate-set resolution outcome. It
 * deliberately retains neither candidate membership nor the final destination.
 */
export function buildPolicyCandidateContrastiveOutcomeAttribution({
  classificationDetails = null,
  answer = null,
  candidateDestinations = [],
  selectedDestinationLibraryId = null,
} = {}) {
  const contrastiveEvidence = buildPolicyCandidateContrastiveEvidenceProjection(
    classificationDetails?.candidate_contrastive_evidence,
  );
  if (!contrastiveEvidence || !TRACKED_CONTRASTIVE_STATUS_IDS.has(contrastiveEvidence.status_id)) {
    return null;
  }

  const selectionOutcome = buildPolicyRuntimeCandidateSetSelectionOutcome({
    answer,
    candidateDestinations,
    selectedDestinationLibraryId,
  });
  if (!selectionOutcome) return null;

  return Object.freeze({
    version: POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_ATTRIBUTION_VERSION,
    contrastiveStatusId: contrastiveEvidence.status_id,
    selectionStatusId: selectionOutcome.statusId,
  });
}

/**
 * Rebuilds the persisted attribution from a strict two-axis allow-list. Raw
 * identity, destination, candidate, catalog, provider, and actor values are
 * rejected before metadata is written.
 */
export function buildPolicyCandidateContrastiveOutcomeAttributionProjection(value = {}) {
  const contrastiveStatusId = value?.contrastiveStatusId ?? value?.contrastive_status_id;
  const selectionStatusId = value?.selectionStatusId ?? value?.selection_status_id;
  if (value?.version !== POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_ATTRIBUTION_VERSION ||
      !TRACKED_CONTRASTIVE_STATUS_IDS.has(contrastiveStatusId) ||
      !SELECTION_STATUS_IDS.has(selectionStatusId)) {
    return null;
  }

  return Object.freeze({
    version: POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_ATTRIBUTION_VERSION,
    contrastive_status_id: contrastiveStatusId,
    selection_status_id: selectionStatusId,
  });
}
