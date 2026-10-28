/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { canonicalDatabaseBigintId } from './databaseIntegerValues.mjs';
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { captureCorrectionDecisionContext, readCorrectionDecisionContext } from './classificationDestinationDecision.mjs';
import { safeParseJsonObject } from '../utils/classificationRetryPayloads.mjs';

export const FEEDBACK_SELECTION_SNAPSHOT_VERSION = 'classification.feedback_outcome.v2';
const keys = ['version', 'classificationId', 'mediaType', 'tmdbId', 'selectedLibraryId', 'decisionContext',
  'action', 'intake', 'reference', 'referenceRelation'];
const exact = (value, expected) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
const integer = value => typeof value === 'number' && positiveDatabaseInteger(value) !== null;
const relation = (reference, selected) => reference === null ? 'unknown' : reference.libraryId === selected ? 'matches' : 'differs';

/** A selection and commit-time reference are not an explicit confirmation/change command. */
export function readFeedbackSelectionSnapshot(value) {
  if (!exact(value, keys) || value.version !== FEEDBACK_SELECTION_SNAPSHOT_VERSION ||
      typeof value.classificationId !== 'string' || canonicalDatabaseBigintId(value.classificationId) !== value.classificationId ||
      !['movie', 'tv'].includes(value.mediaType) || !integer(value.tmdbId) || !integer(value.selectedLibraryId) ||
      value.action !== 'selection' || !['standalone', 'prompt'].includes(value.intake)) return null;
  const reference = value.reference;
  if (reference !== null && (!exact(reference, ['kind', 'libraryId']) ||
      reference.kind !== 'server_shortlist_at_commit' || !integer(reference.libraryId))) return null;
  if (value.referenceRelation !== relation(reference, value.selectedLibraryId)) return null;
  const context = value.decisionContext === null ? null : readCorrectionDecisionContext(value.decisionContext);
  if (value.decisionContext !== null && (!context || String(context.classificationId) !== value.classificationId ||
      context.capture.mediaType !== value.mediaType || context.capture.tmdbId !== value.tmdbId)) return null;
  return { version: FEEDBACK_SELECTION_SNAPSHOT_VERSION, classificationId: value.classificationId,
    mediaType: value.mediaType, tmdbId: value.tmdbId, selectedLibraryId: value.selectedLibraryId,
    decisionContext: context, action: 'selection', intake: value.intake,
    reference: reference === null ? null : { kind: reference.kind, libraryId: reference.libraryId }, referenceRelation: value.referenceRelation };
}

export function buildFeedbackSelectionSnapshot(classification, selectedLibraryId, intake) {
  if (!classification) return null;
  const ranked = safeParseJsonObject(classification.metadata).classification_details?.ranked_candidates;
  const raw = Array.isArray(ranked) ? ranked[0]?.library_id : null;
  // Do not skip an invalid leader, coerce booleans/whitespace, or use another destination.
  const referenceId = typeof raw === 'number' || typeof raw === 'string' && /^[1-9][0-9]{0,9}$/.test(raw)
    ? positiveDatabaseInteger(raw) : null;
  const reference = referenceId === null ? null : { kind: 'server_shortlist_at_commit', libraryId: referenceId };
  const selected = positiveDatabaseInteger(selectedLibraryId);
  return readFeedbackSelectionSnapshot({ version: FEEDBACK_SELECTION_SNAPSHOT_VERSION,
    classificationId: canonicalDatabaseBigintId(classification.id), mediaType: classification.media_type,
    tmdbId: positiveDatabaseInteger(classification.tmdb_id), selectedLibraryId: selected,
    decisionContext: captureCorrectionDecisionContext(classification), action: 'selection', intake,
    reference, referenceRelation: relation(reference, selected) });
}

/** Call only with an already parsed v1/v2 snapshot and its independent receipt projection. */
export function feedbackSnapshotMatchesReceipt(snapshot, receipt) {
  const id = canonicalDatabaseBigintId(receipt.classification_id);
  if (!snapshot || !id || snapshot.decisionContext && String(snapshot.decisionContext.classificationId) !== id) return false;
  return snapshot.version !== FEEDBACK_SELECTION_SNAPSHOT_VERSION ||
    snapshot.classificationId === id && snapshot.intake === receipt.intake;
}
