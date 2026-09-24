/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readCorrectionDecisionContext } from './classificationDestinationDecision.mjs';
import { NON_CLASSIFIER_CAPTURE_METHODS } from './classificationCandidateCapture.mjs';
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';

export const CORRECTION_DECISION_ROW_LIMIT = 5000;
const counters = () => ({ completedAgreement: 0, completedDisagreement: 0, awaitingDecision: 0,
  pendingRetry: 0, nonClassifier: 0, conflictingEvidence: 0, unavailableDestination: 0, missingContext: 0 });
const finish = counts => ({ ...counts, completedDecisions: counts.completedAgreement + counts.completedDisagreement,
  correctedCohortAgreementRate: counts.completedAgreement + counts.completedDisagreement === 0 ? null :
    counts.completedAgreement / (counts.completedAgreement + counts.completedDisagreement) });

/** No scoring or training. Repeated feedback cannot increase the decision denominator. */
export function evaluateCorrectionDestinationDecisions(rows) {
  if (!Array.isArray(rows) || rows.length > CORRECTION_DECISION_ROW_LIMIT) throw new Error('saved_decisions_row_budget');
  const groups = new Map(), overall = counters(), byMediaType = { movie: counters(), tv: counters() };
  let missingContextRows = 0, excludedMediaRows = 0, invalidIdentityRows = 0;
  for (const row of rows) {
    if (!['movie', 'tv'].includes(row.media_type)) { excludedMediaRows++; continue; }
    const context = readCorrectionDecisionContext(row.decision_context);
    if (!context) {
      missingContextRows++;
      const id = positiveDatabaseInteger(row.decision_context?.classificationId);
      // A malformed capture with known lineage must not disappear beside a valid one.
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
    // A conflicting or invalid later observation invalidates the whole decision.
    group.conflict ||= !identityMatches || !target || group.identities.size > 1 ||
      JSON.stringify(group.context) !== JSON.stringify(context);
    group.unavailable ||= row.target_available !== true;
    if (!identityMatches || !target) invalidIdentityRows++;
    groups.set(classificationId, group);
  }
  let repeatedCorrectionRows = 0;
  for (const group of groups.values()) {
    repeatedCorrectionRows += group.rows - 1;
    const capture = group.context?.capture;
    const bucket = !capture ? 'missingContext' : group.conflict || group.labels.size !== 1 ? 'conflictingEvidence' :
      group.unavailable ? 'unavailableDestination' : NON_CLASSIFIER_CAPTURE_METHODS.includes(capture.method) ? 'nonClassifier' :
      capture.status === 'awaiting_decision' ? 'awaitingDecision' : capture.status === 'pending_retry' ? 'pendingRetry' :
      group.labels.has(capture.libraryId) ? 'completedAgreement' : 'completedDisagreement';
    overall[bucket]++;
    byMediaType[capture?.mediaType ?? group.mediaType][bucket]++;
  }
  return { version: 'correction_destination_decisions.v1', status: rows.length ? 'complete' : 'no_eligible_corrections',
    qualityStatus: overall.completedAgreement + overall.completedDisagreement ? 'correction_cohort_measured' : 'no_completed_decision_labels',
    retainedRows: rows.length, uniqueDecisions: groups.size, repeatedCorrectionRows, missingContextRows, excludedMediaRows, invalidIdentityRows,
    overall: finish(overall), byMediaType: Object.fromEntries(Object.entries(byMediaType).map(([type, counts]) => [type, finish(counts)])),
    limitations: { correctionSelectionBias: true, notFullPipelineAccuracy: true, notExecutedRouting: true,
      historicalContextNotReconstructed: true, retentionDays: 30 },
    promotionAllowed: false, routingWrites: 0, providerCalls: 0 };
}
