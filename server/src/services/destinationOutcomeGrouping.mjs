/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readCorrectionDecisionContext } from './classificationDestinationDecision.mjs';
import { NON_CLASSIFIER_CAPTURE_METHODS } from './classificationCandidateCapture.mjs';
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';

export const DESTINATION_OUTCOME_ROW_LIMIT = 5000;

/** One decision can have many receipts, but never more than one evaluation vote. */
export function groupDestinationOutcomes(rows) {
  if (!Array.isArray(rows) || rows.length > DESTINATION_OUTCOME_ROW_LIMIT) throw new Error('saved_decisions_row_budget');
  const groups = new Map();
  let missingContextRows = 0, excludedMediaRows = 0, invalidIdentityRows = 0;
  for (const row of rows) {
    if (!['movie', 'tv'].includes(row.media_type)) { excludedMediaRows++; continue; }
    const context = readCorrectionDecisionContext(row.decision_context);
    if (!context) {
      missingContextRows++;
      const id = positiveDatabaseInteger(row.classification_id ?? row.decision_context?.classificationId);
      if (id) {
        const group = groups.get(id) ?? { context: null, mediaType: row.media_type, identities: new Set(), labels: new Set(), rows: 0 };
        group.conflict = true;
        group.rows++;
        groups.set(id, group);
      }
      continue;
    }
    const { capture, classificationId } = context;
    const identityMatches = capture.mediaType === row.media_type && (capture.tmdbId === null
      ? /^source:[a-f0-9]{64}$/.test(row.identity_key)
      : row.identity_key === `${capture.mediaType}:${capture.tmdbId}`);
    const target = positiveDatabaseInteger(row.selected_library_id);
    const group = groups.get(classificationId) ?? { context, identities: new Set(), labels: new Set(), conflict: false, unavailable: false, rows: 0 };
    group.context ??= context;
    group.rows++;
    group.identities.add(row.identity_key);
    group.labels.add(target);
    group.conflict ||= !identityMatches || !target || group.identities.size > 1 ||
      JSON.stringify(group.context) !== JSON.stringify(context);
    group.unavailable ||= row.target_available !== true;
    if (!identityMatches || !target) invalidIdentityRows++;
    groups.set(classificationId, group);
  }
  return { groups, missingContextRows, excludedMediaRows, invalidIdentityRows };
}

export function destinationOutcomeBucket(group) {
  const capture = group.context?.capture;
  return !capture ? 'missingContext' : group.conflict || group.labels.size !== 1 ? 'conflictingEvidence' :
    group.unavailable ? 'unavailableDestination' : NON_CLASSIFIER_CAPTURE_METHODS.includes(capture.method) ? 'nonClassifier' :
    capture.status === 'awaiting_decision' ? 'awaitingDecision' : capture.status === 'pending_retry' ? 'pendingRetry' :
    group.labels.has(capture.libraryId) ? 'completedAgreement' : 'completedDisagreement';
}
