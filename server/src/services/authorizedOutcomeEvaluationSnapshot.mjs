/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { readClassificationDestinationDecision, readCorrectionDecisionContext } from './classificationDestinationDecision.mjs';
import { safeParseJsonObject } from '../utils/classificationRetryPayloads.mjs';

export const AUTHORIZED_EVALUATION_SOURCE_IDS = Object.freeze(['manual_classification_change', 'operator_confirmation']);
export const AUTHORIZED_EVALUATION_STATUS_IDS = Object.freeze(['resolved', 'routed']);

export function authorizedOutcomeDecisionContext(classification) {
  const capture = readClassificationDestinationDecision(safeParseJsonObject(classification.metadata)
    .classification_details?.destination_decision);
  // Runtime resolution deliberately changes history.method; the original capture does not.
  if (!capture || capture.mediaType !== classification.media_type ||
      capture.tmdbId !== positiveDatabaseInteger(classification.tmdb_id) ||
      (classification.tmdb_id != null && capture.tmdbId === null)) return null;
  return readCorrectionDecisionContext({ classificationId: positiveDatabaseInteger(classification.id), capture });
}

/** Validate private SQL projections before either evaluation consumer uses them. */
export function validateAuthorizedOutcomeEvaluationRow(row) {
  if (row?.origin !== 'authorized_outcome') return;
  const evidence = row.authorized_snapshot;
  const keys = ['snapshot_version', 'event_key', 'action_kind', 'snapshot_missing', 'binding_valid'];
  if (!evidence || Object.keys(evidence).length !== keys.length || !keys.every(key => Object.hasOwn(evidence, key))) {
    throw new Error('authorized_evaluation_invalid_snapshot');
  }
  if (evidence.snapshot_missing === true) {
    if (row.identity_key != null || row.tmdb_id != null || row.media_type != null || row.selected_library_id != null ||
        row.decision_context != null || row.was_correction != null || evidence.snapshot_version !== null || evidence.action_kind !== null ||
        evidence.binding_valid !== null || !/^missing:[1-9][0-9]*$/.test(evidence.event_key)) throw new Error('authorized_evaluation_invalid_gap');
    return;
  }
  const type = row.media_type, key = row.identity_key, id = positiveDatabaseInteger(row.tmdb_id);
  const identityValid = typeof key === 'string' && (row.tmdb_id == null
    ? /^source:[a-f0-9]{64}$/.test(key) : id !== null && key === `${type}:${id}`);
  const context = row.decision_context == null ? null : readCorrectionDecisionContext(row.decision_context);
  if (evidence.snapshot_version !== 1 || evidence.snapshot_missing !== false || evidence.binding_valid !== true || !['movie', 'tv'].includes(type) ||
      !identityValid || !positiveDatabaseInteger(row.selected_library_id) ||
      !['confirmation', 'correction'].includes(evidence.action_kind) || row.was_correction !== (evidence.action_kind === 'correction') ||
      typeof evidence.event_key !== 'string' || !/^(classification_correction:[1-9][0-9]*|runtime_resolution:[1-9][0-9]*:[A-Za-z0-9_-]{22})$/.test(evidence.event_key) ||
      (row.decision_context != null && (!context || String(context.classificationId) !== String(row.classification_id) ||
        context.capture.mediaType !== type || context.capture.tmdbId !== id))) throw new Error('authorized_evaluation_invalid_snapshot');
}

/** Tier-specific receipts for the same explicit action cannot create extra votes. */
export function prepareAuthorizedOutcomeEvaluationRows(rows) {
  const events = new Map(), output = [];
  for (const row of rows) {
    validateAuthorizedOutcomeEvaluationRow(row);
    if (row.origin !== 'authorized_outcome' || row.authorized_snapshot.snapshot_missing) { output.push(row); continue; }
    const key = row.authorized_snapshot.event_key;
    if (!events.has(key)) events.set(key, new Map());
    const signature = JSON.stringify([row.classification_id, row.media_type, row.identity_key, row.selected_library_id,
      row.was_correction, row.decision_context]);
    const copies = events.get(key);
    if (!copies.has(signature)) copies.set(signature, row);
  }
  for (const copies of events.values()) {
    for (const row of copies.values()) output.push(copies.size > 1 ? { ...row, evidence_conflict: true } : row);
  }
  return output;
}
