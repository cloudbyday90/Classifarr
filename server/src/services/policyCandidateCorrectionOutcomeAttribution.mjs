/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_CORRECTION_SIGNAL_SNAPSHOT_VERSION,
  buildPolicyCandidateCorrectionSignalSnapshotProjection,
} from './policyCandidateCorrectionSignalSnapshot.mjs';
import {
  POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS,
  buildPolicyRuntimeCandidateSetSelectionOutcome,
} from './policyRuntimeCandidateSetSelectionOutcome.mjs';

export const POLICY_CANDIDATE_CORRECTION_OUTCOME_ATTRIBUTION_VERSION =
  'policy.candidate_correction_outcome_attribution.v1';

const SELECTION_STATUS_IDS = new Set(
  Object.values(POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS),
);

/**
 * Pairs the original content-free leading-candidate signal snapshot with the
 * validated operator outcome. Candidate and destination identities are used
 * only to derive the selection status and are then discarded.
 */
export function buildPolicyCandidateCorrectionOutcomeAttribution({
  classificationDetails = null,
  answer = null,
  candidateDestinations = [],
  selectedDestinationLibraryId = null,
} = {}) {
  const signalSnapshot = buildPolicyCandidateCorrectionSignalSnapshotProjection(
    classificationDetails?.policy_candidate_correction_signal_snapshot,
  );
  if (!signalSnapshot) return null;

  const selectionOutcome = buildPolicyRuntimeCandidateSetSelectionOutcome({
    answer,
    candidateDestinations,
    selectedDestinationLibraryId,
  });
  if (!selectionOutcome) return null;

  return Object.freeze({
    version: POLICY_CANDIDATE_CORRECTION_OUTCOME_ATTRIBUTION_VERSION,
    scoreMarginBandId: signalSnapshot.score_margin_band_id,
    selectionStatusId: selectionOutcome.statusId,
    evidenceSourceStates: signalSnapshot.evidence_source_states,
  });
}

/**
 * Retains only the fixed version, score-margin band, selection status, and
 * five evidence source states at the metadata write boundary.
 */
export function buildPolicyCandidateCorrectionOutcomeAttributionProjection(value = {}) {
  const scoreMarginBandId = value?.score_margin_band_id ?? value?.scoreMarginBandId;
  const selectionStatusId = value?.selection_status_id ?? value?.selectionStatusId;
  const signalSnapshot = buildPolicyCandidateCorrectionSignalSnapshotProjection({
    version: POLICY_CANDIDATE_CORRECTION_SIGNAL_SNAPSHOT_VERSION,
    score_margin_band_id: scoreMarginBandId,
    evidence_source_states: value?.evidence_source_states ?? value?.evidenceSourceStates,
  });
  if (value?.version !== POLICY_CANDIDATE_CORRECTION_OUTCOME_ATTRIBUTION_VERSION ||
      !SELECTION_STATUS_IDS.has(selectionStatusId) || !signalSnapshot) {
    return null;
  }

  return Object.freeze({
    version: POLICY_CANDIDATE_CORRECTION_OUTCOME_ATTRIBUTION_VERSION,
    score_margin_band_id: signalSnapshot.score_margin_band_id,
    selection_status_id: selectionStatusId,
    evidence_source_states: signalSnapshot.evidence_source_states,
  });
}
