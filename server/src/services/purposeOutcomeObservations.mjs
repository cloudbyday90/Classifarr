/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { canonicalDatabaseBigintId } from './databaseIntegerValues.mjs';
import { validateAuthorizedOutcomeEvaluationRow } from './authorizedOutcomeEvaluationSnapshot.mjs';
import { readFeedbackOutcomeSnapshot } from './feedbackOutcomeSnapshot.mjs';
import { validPurposeOutcomeReference, PURPOSE_OUTCOME_GAPS, purposeOutcomeTime } from './purposeOutcomeReference.mjs';
import { readCorrectionDecisionContext } from './classificationDestinationDecision.mjs';

const identity = (key, type) => typeof key === 'string' && ['movie', 'tv'].includes(type) &&
  (/^(movie|tv):[1-9][0-9]{0,9}$/.test(key) && key.startsWith(`${type}:`) && Number(key.split(':')[1]) <= 2147483647 || /^source:[a-f0-9]{64}$/.test(key));
const contexts = { manual: 'manual_prior_destination', runtime: 'runtime_answer_contract', history_review: 'original_automated_destination' };
const compareInteger = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const compareEvents = (a, b) => compareInteger(a.order, b.order) || compareInteger(BigInt(a.classificationId), BigInt(b.classificationId)) ||
  compareInteger(BigInt(a.sourceOrder), BigInt(b.sourceOrder)) || a.eventKey.localeCompare(b.eventKey);

/** Normalize only independently frozen choices. Unknown/selection evidence can reserve holdouts, never labels. */
export function readPurposeOutcomeObservation(row, now) {
  const id = canonicalDatabaseBigintId(row?.classification_id), at = purposeOutcomeTime(row?.observed_at), source = row?.source;
  if (!id || !Number.isFinite(at) || at > now || !source || typeof row.event_key !== 'string' ||
      typeof row.observed_order !== 'string' || !/^[0-9]{1,19}$/.test(row.observed_order) ||
      BigInt(row.observed_order) / 1000n !== BigInt(at)) throw new Error('purpose_cohort_invalid_source');
  const sourceOrder = row.origin === 'authorized' ? canonicalDatabaseBigintId(source.source_id) : id;
  if (!sourceOrder) throw new Error('purpose_cohort_invalid_source');
  const result = { eventKey: row.event_key, classificationId: id, at, aliases: new Set([`classification:${id}`]),
    mediaType: null, identityKey: null, destination: null, action: null, sourceKind: null, actionReference: null,
    targetAvailable: false, gap: null, payload: null, referenceBinding: null, order: BigInt(row.observed_order), sourceOrder };
  if (typeof row.holdout_identity === 'string' && /^(movie|tv):[1-9][0-9]{0,9}$/.test(row.holdout_identity)) result.aliases.add(row.holdout_identity);
  if (row.origin === 'authorized') {
    validateAuthorizedOutcomeEvaluationRow(source);
    if (source.authorized_snapshot.event_key !== row.event_key || String(source.classification_id) !== id ||
        purposeOutcomeTime(source.observed_at) !== at) throw new Error('purpose_cohort_source_binding');
    if (source.authorized_snapshot.snapshot_missing) result.gap = 'missing_action_evidence';
    else {
      result.mediaType = source.media_type; result.identityKey = source.identity_key; result.destination = source.selected_library_id;
      result.action = source.was_correction ? 'correction' : 'confirmation';
      result.sourceKind = row.event_key.startsWith('classification_correction:') ? 'manual' : 'runtime';
      result.targetAvailable = source.target_available === true;
      result.referenceBinding = source.decision_context == null ? null : readCorrectionDecisionContext(source.decision_context);
      if (source.evidence_conflict) result.gap = 'conflicting';
    }
  } else if (row.origin === 'feedback') {
    if (source.classification_id !== id || row.event_key !== `feedback_review:${id}`) throw new Error('purpose_cohort_source_binding');
    const snapshot = readFeedbackOutcomeSnapshot(source.snapshot);
    if (!snapshot) result.gap = 'missing_action_evidence';
    else {
      result.mediaType = snapshot.mediaType; result.identityKey = `${snapshot.mediaType}:${snapshot.tmdbId}`;
      if (snapshot.version !== 'classification.feedback_outcome.v3') result.gap = snapshot.action === 'selection' ? 'selection_only' : 'unknown_action';
      else if (snapshot.classificationId !== id || source.intake !== 'standalone' || source.feedback_id == null ||
          snapshot.reference.reviewId !== source.review_id || snapshot.reference.actorFingerprint !== source.review_actor_fingerprint) {
        throw new Error('purpose_cohort_source_binding');
      } else {
        result.sourceKind = 'history_review'; result.destination = snapshot.selectedLibraryId; result.action = snapshot.action;
        result.targetAvailable = source.target_available === true;
        result.referenceBinding = [snapshot.reference.kind, snapshot.reference.libraryId, snapshot.decisionContext];
      }
    }
  } else throw new Error('purpose_cohort_invalid_source');
  if (identity(result.identityKey, result.mediaType)) result.aliases.add(result.identityKey);
  result.actionReference = contexts[result.sourceKind] ?? null;
  if (result.gap) return result;
  const supplement = row.supplement;
  if (!supplement) { result.gap = 'missing_supplement'; return result; }
  if (identity(supplement.identity_key, supplement.media_type)) result.aliases.add(supplement.identity_key);
  const expires = purposeOutcomeTime(supplement.expires_at);
  if (!Number.isFinite(expires) || expires > at + 30 * 86400000) throw new Error('purpose_cohort_invalid_supplement');
  if (supplement.event_key === row.event_key && supplement.classification_id === id && expires <= now) {
    result.gap = 'expired'; return result;
  }
  if (supplement.supplement_version !== 1 || supplement.event_key !== row.event_key || supplement.classification_id !== id ||
      supplement.identity_key !== result.identityKey || supplement.media_type !== result.mediaType ||
      supplement.selected_library_id !== result.destination || supplement.action_kind !== result.action ||
      supplement.source_kind !== result.sourceKind || supplement.action_reference !== result.actionReference ||
      purposeOutcomeTime(supplement.observed_at) !== at || !Number.isFinite(purposeOutcomeTime(supplement.frozen_at)) ||
      purposeOutcomeTime(supplement.frozen_at) < at || purposeOutcomeTime(supplement.frozen_at) > now) {
    result.gap = 'binding_failure'; return result;
  }
  if (supplement.reason_id !== 'available') {
    if (!PURPOSE_OUTCOME_GAPS.includes(supplement.reason_id) || supplement.payload !== null || supplement.expired_at !== null ||
        expires !== at + 30 * 86400000) throw new Error('purpose_cohort_invalid_supplement');
    result.gap = supplement.reason_id; return result;
  }
  if (supplement.expired_at !== null || !validPurposeOutcomeReference(supplement.payload) ||
      purposeOutcomeTime(supplement.payload.capturedAt) > at ||
      expires !== Math.min(purposeOutcomeTime(supplement.payload.expiresAt), at + 30 * 86400000)) throw new Error('purpose_cohort_invalid_supplement');
  result.payload = supplement.payload;
  if (!result.targetAvailable) result.gap = 'unavailable_destination';
  return result;
}

/** Canonical aliases are validated in full before first-event identity holdouts or denominators. */
export function preparePurposeOutcomeEvents(rows, now) {
  const events = new Map();
  for (const row of rows) {
    const value = readPurposeOutcomeObservation(row, now);
    if (!events.has(value.eventKey)) events.set(value.eventKey, []);
    events.get(value.eventKey).push(value);
  }
  return [...events.values()].map(copies => {
    copies.sort(compareEvents);
    const first = copies[0], signature = value => JSON.stringify([value.classificationId, value.mediaType, value.identityKey,
      value.destination, value.action, value.sourceKind, value.actionReference, value.referenceBinding]);
    const aliases = new Set(copies.flatMap(value => [...value.aliases]));
    const conflict = copies.some(value => signature(value) !== signature(first) || value.gap === 'conflicting');
    const gap = conflict ? 'conflicting' : copies.find(value => value.gap)?.gap ?? null;
    return { ...first, aliases, gap };
  }).sort(compareEvents);
}
