/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { readClassificationOutcomeIdentity } from './classificationOutcomeIdentity.mjs';
import { authorizedOutcomeDecisionContext, AUTHORIZED_EVALUATION_SOURCE_IDS, AUTHORIZED_EVALUATION_STATUS_IDS } from './authorizedOutcomeEvaluationSnapshot.mjs';
import { readRuntimeOutcomeEvaluationTime } from './runtimeOutcomeEvaluationTime.mjs';
import { captureAuthorizedPurposeOutcome } from './purposeOutcomePersistence.mjs';

async function actionEvidence(client, command, state) {
  if (command.sourceId === 'manual_classification_change') {
    const match = /^classification_correction:([1-9][0-9]*)$/.exec(command.sourceEventId);
    if (!match) return null;
    const { rows = [] } = await client.query(`SELECT original_library_id, corrected_library_id
      FROM classification_corrections WHERE id::text = $1 AND classification_id = $2
        AND corrected_library_id = $3 AND corrected_by = $4 AND btrim(corrected_by) <> ''`,
    [match[1], command.currentState.classificationId, command.finalOutcome.destinationLibraryId, command.authorization.actorId]) ?? {};
    if (!rows[0]) return null;
    return { eventKey: command.sourceEventId, kind: rows[0].original_library_id === rows[0].corrected_library_id ? 'confirmation' : 'correction' };
  }
  const resolution = state.resolution;
  if (resolution?.validAnswer !== true || resolution.finalOutcomeRecorded !== true ||
      !['confirm_destination', 'change_destination'].includes(resolution.actionId) ||
      !/^[A-Za-z0-9_-]{22}$/.test(resolution.contractFingerprint ?? '')) return null;
  return { eventKey: `runtime_resolution:${command.currentState.classificationId}:${resolution.contractFingerprint}`,
    kind: resolution.actionId === 'change_destination' ? 'correction' : 'confirmation' };
}

/** Only the new-claim path calls this, in the same transaction as all authorized effects. */
export async function captureAuthorizedOutcomeEvaluation({ client, command, executionState, receipt }) {
  if (!receipt?.id || !AUTHORIZED_EVALUATION_SOURCE_IDS.includes(command.sourceId) ||
      !AUTHORIZED_EVALUATION_STATUS_IDS.includes(command.finalOutcome.status)) return false;
  const action = await actionEvidence(client, command, executionState);
  if (!action) return false;
  const { rows } = await client.query(`SELECT id, tmdb_id, media_type, method, metadata, title, year, transaction_timestamp() AS evaluation_now
    FROM classification_history WHERE id = $1 FOR UPDATE`, [command.currentState.classificationId]);
  const classification = rows[0];
  if (!classification) return false;
  if (String(classification.id) !== String(executionState.classification?.id) ||
      classification.media_type !== executionState.classification.mediaType ||
      positiveDatabaseInteger(classification.tmdb_id) !== positiveDatabaseInteger(executionState.classification.tmdbId)) {
    throw new Error('authorized_evaluation_identity_drift');
  }
  const identity = await readClassificationOutcomeIdentity(client, classification);
  if (!identity) return false;
  const observedAt = command.sourceId === 'operator_confirmation'
    ? readRuntimeOutcomeEvaluationTime(classification, executionState.resolution) : null;
  if (command.sourceId === 'operator_confirmation' && observedAt === null) return false;
  const result = await client.query(`INSERT INTO policy_authorized_outcome_evaluation_snapshots
    (receipt_id, event_key, media_type, identity_key, selected_library_id, action_kind, decision_context, observed_at)
    SELECT r.id, $2, $3, $4, r.destination_library_id, $5, $6::jsonb, COALESCE($12::timestamptz, r.created_at)
    FROM policy_authorized_outcome_source_event_receipts r
    WHERE r.id = $1 AND r.classification_id = $7 AND r.destination_library_id = $8
      AND r.source_id = $9 AND r.source_event_id = $10 AND r.command_fingerprint = $11
      AND r.final_outcome_status_id IN ('resolved', 'routed')
    ON CONFLICT (receipt_id) DO NOTHING RETURNING receipt_id`,
  [receipt.id, action.eventKey, classification.media_type, identity, action.kind, authorizedOutcomeDecisionContext(classification),
    command.currentState.classificationId, command.finalOutcome.destinationLibraryId, command.sourceId, command.sourceEventId, receipt.commandFingerprint, observedAt]);
  if (result.rowCount !== 1) throw new Error('authorized_evaluation_receipt_binding');
  await captureAuthorizedPurposeOutcome(client, receipt.id);
  return true;
}

export async function pruneAuthorizedOutcomeEvaluation(client) {
  const result = await client.query(`DELETE FROM policy_authorized_outcome_evaluation_snapshots WHERE receipt_id IN (
    SELECT receipt_id FROM policy_authorized_outcome_evaluation_snapshots
    WHERE observed_at <= NOW() - INTERVAL '30 days' ORDER BY observed_at, receipt_id
    LIMIT 1000 FOR UPDATE SKIP LOCKED)`);
  return result.rowCount;
}
