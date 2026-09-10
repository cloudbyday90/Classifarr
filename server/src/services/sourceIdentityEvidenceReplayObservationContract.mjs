/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import {
  SOURCE_IDENTITY_EVIDENCE_REPLAY_OUTCOME_IDS,
  SOURCE_IDENTITY_EVIDENCE_REPLAY_RESOLUTION_REASON_IDS,
  SOURCE_IDENTITY_EVIDENCE_REPLAY_VERSION,
} from './sourceIdentityExternalEvidenceReplay.mjs';

export const SOURCE_IDENTITY_EVIDENCE_REPLAY_OBSERVATION_VERSION = 'source_identity_evidence_replay_observation.v1';
export const SOURCE_IDENTITY_EVIDENCE_REPLAY_OBSERVATION_STATUS_IDS = Object.freeze([
  'complete',
  'failed',
  'no_current_conflicts',
]);
export const SOURCE_IDENTITY_EVIDENCE_REPLAY_OBSERVATION_RETENTION_DAYS = 120;

const STATUS_IDS = new Set(SOURCE_IDENTITY_EVIDENCE_REPLAY_OBSERVATION_STATUS_IDS);
const SUMMARY_NUMBER_KEYS = Object.freeze([
  'selectedObservationCount',
  'maximumObservations',
  'maximumObservationsPerLibrary',
  'libraryLimit',
  'activeLibraryCount',
  'selectedLibraryCount',
  'excludedLibraryCount',
]);
const SUMMARY_KEYS = new Set([
  ...SUMMARY_NUMBER_KEYS,
  'librarySelection',
  'outcomes',
  'resolutionReasons',
]);

function requiredCount(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError('Source identity evidence replay observation contains an invalid aggregate count.');
  }
  return value;
}

function fixedCountMap(value, allowedIds) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Source identity evidence replay observation contains an invalid aggregate map.');
  }
  const allowed = new Set(allowedIds);
  const result = {};
  for (const [id, count] of Object.entries(value)) {
    if (!allowed.has(id)) {
      throw new TypeError('Source identity evidence replay observation contains an unsupported aggregate code.');
    }
    result[id] = requiredCount(count);
  }
  return Object.freeze(result);
}

/**
 * Allows only the fixed, aggregate replay receipt to enter durable history.
 * It rejects source/provider identifiers, candidate values, URLs, credentials,
 * and future unrecognised result fields instead of retaining them by accident.
 */
export function toSourceIdentityEvidenceReplayObservation(receipt) {
  if (!receipt || receipt.version !== SOURCE_IDENTITY_EVIDENCE_REPLAY_VERSION ||
      !STATUS_IDS.has(receipt.status?.id)) {
    throw new TypeError('A supported source identity evidence replay receipt is required.');
  }

  if (receipt.status.id === 'failed') {
    if (receipt.summary !== null) {
      throw new TypeError('A failed source identity evidence replay receipt cannot contain a summary.');
    }
    return Object.freeze({
      version: SOURCE_IDENTITY_EVIDENCE_REPLAY_OBSERVATION_VERSION,
      status: Object.freeze({ id: receipt.status.id }),
      summary: null,
    });
  }

  const summary = receipt.summary;
  if (!summary || typeof summary !== 'object' || summary.librarySelection !== 'daily_rotating_library_id_window') {
    throw new TypeError('A complete source identity evidence replay receipt requires the fixed library window.');
  }
  if (Object.keys(summary).some((key) => !SUMMARY_KEYS.has(key))) {
    throw new TypeError('A source identity evidence replay observation cannot retain unrecognised summary fields.');
  }
  const projectedSummary = Object.fromEntries(SUMMARY_NUMBER_KEYS.map((key) => [key, requiredCount(summary[key])]));
  projectedSummary.librarySelection = summary.librarySelection;
  projectedSummary.outcomes = fixedCountMap(summary.outcomes, SOURCE_IDENTITY_EVIDENCE_REPLAY_OUTCOME_IDS);
  projectedSummary.resolutionReasons = fixedCountMap(
    summary.resolutionReasons,
    SOURCE_IDENTITY_EVIDENCE_REPLAY_RESOLUTION_REASON_IDS,
  );
  if (Object.values(projectedSummary.outcomes).reduce((total, count) => total + count, 0) !==
      projectedSummary.selectedObservationCount ||
      Object.values(projectedSummary.resolutionReasons).reduce((total, count) => total + count, 0) >
        projectedSummary.selectedObservationCount) {
    throw new TypeError('Source identity evidence replay observation totals are inconsistent.');
  }
  if ((receipt.status.id === 'no_current_conflicts' && projectedSummary.selectedObservationCount !== 0) ||
      (receipt.status.id === 'complete' && projectedSummary.selectedObservationCount === 0)) {
    throw new TypeError('Source identity evidence replay observation status is inconsistent with its selected count.');
  }

  return Object.freeze({
    version: SOURCE_IDENTITY_EVIDENCE_REPLAY_OBSERVATION_VERSION,
    status: Object.freeze({ id: receipt.status.id }),
    summary: Object.freeze(projectedSummary),
  });
}
