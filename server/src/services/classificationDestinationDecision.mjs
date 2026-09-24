/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { CLASSIFIER_CAPTURE_METHODS, NON_CLASSIFIER_CAPTURE_METHODS } from './classificationCandidateCapture.mjs';
import { safeParseJsonObject } from '../utils/classificationRetryPayloads.mjs';

const VERSION = 'classification.destination_decision.v1';
const methods = new Set([...CLASSIFIER_CAPTURE_METHODS, ...NON_CLASSIFIER_CAPTURE_METHODS]);
const statuses = new Set(['completed', 'awaiting_decision', 'pending_retry']);
const keys = ['version', 'mediaType', 'tmdbId', 'method', 'status', 'libraryId'];
const exactKeys = (value, expected) => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
const integer = value => typeof value === 'number' && positiveDatabaseInteger(value) !== null;

/** Read a strict, content-free projection; unknown versions and extra fields fail closed. */
export function readClassificationDestinationDecision(value) {
  if (!exactKeys(value, keys) || value.version !== VERSION || !['movie', 'tv'].includes(value.mediaType) ||
      (value.tmdbId !== null && !integer(value.tmdbId)) || !methods.has(value.method) || !statuses.has(value.status) ||
      (value.status === 'completed' ? !integer(value.libraryId) : value.libraryId !== null)) return null;
  return Object.fromEntries(keys.map(key => [key, value[key]]));
}

/** The persisted state is authoritative here, not a shortlist or later operator choice. */
export function buildClassificationDestinationDecision({ metadata, method, status, libraryId }) {
  if (metadata.tmdb_id != null && positiveDatabaseInteger(metadata.tmdb_id) === null) return null;
  return readClassificationDestinationDecision({ version: VERSION, mediaType: metadata.media_type,
    tmdbId: positiveDatabaseInteger(metadata.tmdb_id), method, status,
    libraryId: libraryId == null ? null : positiveDatabaseInteger(libraryId) });
}

export function readCorrectionDecisionContext(value) {
  if (!exactKeys(value, ['classificationId', 'capture']) || !integer(value.classificationId)) return null;
  const capture = readClassificationDestinationDecision(value.capture);
  return capture ? { classificationId: value.classificationId, capture } : null;
}

/** Called with the locked pre-correction row; never reconstruct from mutable library/status. */
export function captureCorrectionDecisionContext(classification) {
  const capture = readClassificationDestinationDecision(safeParseJsonObject(classification.metadata)
    .classification_details?.destination_decision);
  if (!capture || capture.mediaType !== classification.media_type || capture.method !== classification.method ||
      capture.tmdbId !== positiveDatabaseInteger(classification.tmdb_id) ||
      (classification.tmdb_id != null && capture.tmdbId === null)) return null;
  return readCorrectionDecisionContext({ classificationId: positiveDatabaseInteger(classification.id), capture });
}
