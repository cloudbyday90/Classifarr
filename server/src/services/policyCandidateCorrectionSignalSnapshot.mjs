/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_IDS,
  POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS,
  buildPolicyCandidateEvidenceCard,
} from './policyCandidateEvidenceCard.mjs';

export const POLICY_CANDIDATE_CORRECTION_SIGNAL_SNAPSHOT_VERSION =
  'policy.candidate_correction_signal_snapshot.v1';

export const POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_IDS = Object.freeze({
  VERY_CLOSE: '0_to_4',
  CLOSE: '5_to_14',
  CLEAR: '15_to_29',
  DECISIVE: '30_or_more',
});

export const POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER = Object.freeze([
  POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_IDS.VERY_CLOSE,
  POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_IDS.CLOSE,
  POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_IDS.CLEAR,
  POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_IDS.DECISIVE,
]);

export const POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS = Object.freeze([
  POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_IDS.ITEM_IDENTITY,
  POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_IDS.DECLARED_POLICY,
  POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_IDS.OBSERVED_LIBRARY_PROFILE,
  POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_IDS.SIMILAR_ITEM_RETRIEVAL,
  POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_IDS.CONFIRMED_OUTCOMES,
]);

export const POLICY_CANDIDATE_CORRECTION_EVIDENCE_STATE_IDS = Object.freeze(
  Object.values(POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS),
);

const MARGIN_BAND_IDS = new Set(POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER);
const EVIDENCE_SOURCE_IDS = new Set(POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS);
const EVIDENCE_STATE_IDS = new Set(POLICY_CANDIDATE_CORRECTION_EVIDENCE_STATE_IDS);

function score(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 && numericValue <= 100
    ? Math.round(numericValue)
    : null;
}

function marginBandId(margin) {
  if (margin <= 4) return POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_IDS.VERY_CLOSE;
  if (margin <= 14) return POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_IDS.CLOSE;
  if (margin <= 29) return POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_IDS.CLEAR;
  return POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_IDS.DECISIVE;
}

function normalizeEvidenceSourceStates(value) {
  const sourceStates = new Map();
  for (const entry of Array.isArray(value) ? value : []) {
    const sourceId = entry?.source_id ?? entry?.sourceId;
    const stateId = entry?.state_id ?? entry?.stateId;
    if (!EVIDENCE_SOURCE_IDS.has(sourceId) || !EVIDENCE_STATE_IDS.has(stateId) ||
        sourceStates.has(sourceId)) {
      return null;
    }
    sourceStates.set(sourceId, stateId);
  }

  if (sourceStates.size !== POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS.length) return null;

  return Object.freeze(POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS.map((sourceId) => (
    Object.freeze({ source_id: sourceId, state_id: sourceStates.get(sourceId) })
  )));
}

/**
 * Converts one already-derived leading-candidate evidence card and its
 * runner-up score into a content-free evaluation snapshot. Candidate names,
 * IDs, raw scores, metadata, policy text, retrieval text, and model output are
 * intentionally consumed in memory only.
 */
export function buildPolicyCandidateCorrectionSignalSnapshot({
  classification = {},
  rankedCandidates = [],
  sourceMetadata = {},
} = {}) {
  const [leadingCandidate, runnerUpCandidate] = Array.isArray(rankedCandidates)
    ? rankedCandidates
    : [];
  const leadingScore = score(leadingCandidate?.score ?? leadingCandidate?.policyScore);
  const runnerUpScore = score(runnerUpCandidate?.score ?? runnerUpCandidate?.policyScore);
  if (leadingScore === null || runnerUpScore === null) return null;

  const evidenceCard = buildPolicyCandidateEvidenceCard({
    classification,
    candidate: leadingCandidate,
    sourceMetadata,
  });
  const evidenceSourceStates = normalizeEvidenceSourceStates(evidenceCard?.sources);
  if (!evidenceSourceStates) return null;

  return Object.freeze({
    version: POLICY_CANDIDATE_CORRECTION_SIGNAL_SNAPSHOT_VERSION,
    score_margin_band_id: marginBandId(Math.max(0, leadingScore - runnerUpScore)),
    evidence_source_states: evidenceSourceStates,
  });
}

/**
 * Rebuilds the persisted snapshot from a strict allow-list. This is used at
 * every later boundary so an extended metadata object cannot become analytics
 * dimensions or browser-visible data.
 */
export function buildPolicyCandidateCorrectionSignalSnapshotProjection(value = {}) {
  const scoreMarginBandId = value?.score_margin_band_id ?? value?.scoreMarginBandId;
  const evidenceSourceStates = normalizeEvidenceSourceStates(
    value?.evidence_source_states ?? value?.evidenceSourceStates,
  );
  if (value?.version !== POLICY_CANDIDATE_CORRECTION_SIGNAL_SNAPSHOT_VERSION ||
      !MARGIN_BAND_IDS.has(scoreMarginBandId) || !evidenceSourceStates) {
    return null;
  }

  return Object.freeze({
    version: POLICY_CANDIDATE_CORRECTION_SIGNAL_SNAPSHOT_VERSION,
    score_margin_band_id: scoreMarginBandId,
    evidence_source_states: evidenceSourceStates,
  });
}
