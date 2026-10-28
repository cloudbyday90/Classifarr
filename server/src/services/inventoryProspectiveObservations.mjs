/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { prepareAuthorizedOutcomeEvaluationRows } from './authorizedOutcomeEvaluationSnapshot.mjs';
import { readCorrectionDecisionContext } from './classificationDestinationDecision.mjs';
import { readFeedbackOutcomeSnapshot } from './feedbackOutcomeSnapshot.mjs';
import { FEEDBACK_SELECTION_SNAPSHOT_VERSION, feedbackSnapshotMatchesReceipt } from './feedbackSelectionSnapshot.mjs';
import { FEEDBACK_REVIEW_SNAPSHOT_VERSION } from './feedbackReviewOutcomeSnapshot.mjs';
import { readInventoryRankingIdentity } from './inventoryRankingShadowIdentity.mjs';
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { prospectiveTimestamp, prospectiveClassificationId } from './inventoryProspectiveValues.mjs';

const invalid = () => { throw new Error('inventory_prospective_invalid_evidence'); };
const sourceIdentity = key => typeof key === 'string' && /^source:[a-f0-9]{64}$/.test(key);
const sameClass = (a, b) => prospectiveClassificationId(a) !== null &&
  prospectiveClassificationId(a) === prospectiveClassificationId(b);

export function prospectiveObservationCoverage() {
  return { missingSnapshotRows: 0, unknownKindRows: 0, selectionOnlyRows: 0, unverifiedOutcomeRows: 0,
    identityMismatchRows: 0, sourceOnlyRows: 0, unavailableOutcomeRows: 0, excludedTemporalRows: 0 };
}

/** Preserve provenance through validation; unknown legacy fields cannot become action proof. */
export function prepareProspectiveObservations(row, now) {
  const coverage = prospectiveObservationCoverage(), aliases = new Set(), observations = [];
  let uncertain = false;
  for (const evidence of prepareAuthorizedOutcomeEvaluationRows(row.outcomes)) {
    if (!sameClass(evidence.classification_id, row.classification_id)) invalid();
    let key, type, destination, kind, available, missing = false, selectionOnly = false;
    if (evidence.origin === 'authorized_outcome') {
      missing = evidence.authorized_snapshot.snapshot_missing;
      ({ identity_key: key, media_type: type, selected_library_id: destination, was_correction: kind,
        target_available: available } = evidence);
    } else if (evidence.origin === 'retained_correction') {
      const context = evidence.decision_context == null ? null : readCorrectionDecisionContext(evidence.decision_context);
      if (evidence.decision_context != null && !context) invalid();
      if (evidence.event_classification_id != null && !sameClass(evidence.event_classification_id, row.classification_id) ||
          context && !sameClass(context.classificationId, row.classification_id)) invalid();
      ({ identity_key: key, media_type: type, selected_library_id: destination, target_available: available } = evidence);
      if (context && (context.capture.mediaType !== type || (context.capture.tmdbId === null
        ? !sourceIdentity(key) : key !== `${type}:${context.capture.tmdbId}`))) invalid();
      kind = true;
      missing = evidence.event_classification_id == null && !context;
    } else if (evidence.origin === 'legacy_feedback') {
      const snapshot = evidence.feedback_snapshot == null ? null : readFeedbackOutcomeSnapshot(evidence.feedback_snapshot);
      if (evidence.feedback_snapshot != null && !snapshot || snapshot && !feedbackSnapshotMatchesReceipt(snapshot, evidence)) invalid();
      missing = !snapshot;
      selectionOnly = snapshot?.version === FEEDBACK_SELECTION_SNAPSHOT_VERSION;
      if (snapshot) { key = `${snapshot.mediaType}:${snapshot.tmdbId}`; type = snapshot.mediaType; destination = snapshot.selectedLibraryId; }
      kind = snapshot?.version === FEEDBACK_REVIEW_SNAPSHOT_VERSION ? snapshot.action === 'correction' : null;
      available = evidence.target_available;
    } else if (evidence.origin === 'unverified_correction') {
      missing = true;
    } else invalid();

    if (key != null) {
      if (!readInventoryRankingIdentity(key, type) && !(sourceIdentity(key) && ['movie', 'tv'].includes(type))) invalid();
      aliases.add(key);
    }
    const time = prospectiveTimestamp(evidence.observed_at);
    if (!Number.isFinite(time)) invalid();
    if (time < prospectiveTimestamp(row.recorded_at) || time > now) { coverage.excludedTemporalRows++; continue; }
    if (missing) {
      coverage[evidence.origin === 'unverified_correction' || evidence.origin === 'retained_correction'
        ? 'unverifiedOutcomeRows' : 'missingSnapshotRows']++;
      uncertain = true; continue;
    }
    if (!positiveDatabaseInteger(destination) || typeof available !== 'boolean') invalid();
    if (kind === null) { coverage[selectionOnly ? 'selectionOnlyRows' : 'unknownKindRows']++; uncertain = true; }
    if (sourceIdentity(key)) { coverage.sourceOnlyRows++; uncertain = true; }
    if (row.capture.identityKey != null && key !== row.capture.identityKey) { coverage.identityMismatchRows++; uncertain = true; }
    if (!available) coverage.unavailableOutcomeRows++;
    observations.push({ library_id: destination, was_correction: kind, target_available: available,
      evidence_conflict: evidence.evidence_conflict === true, observed_at: time });
  }
  return { observations, aliases, coverage, uncertain };
}
