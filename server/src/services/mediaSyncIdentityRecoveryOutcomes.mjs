/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const RECOVERY_OUTCOME_REASONS = Object.freeze([
  'insufficient_evidence', 'adapter_unsupported', 'provider_unavailable',
  'provider_response_invalid', 'external_evidence_inconclusive', 'external_ids_disagree',
  'candidate_not_supported', 'title_year_mismatch', 'source_changed',
  'source_unavailable', 'internal_error', 'persistence_failed',
]);

/** Latest server-owned outcome, fenced against stale/replayed worker results. */
export async function recordSyncIdentityRecoveryOutcome(store, context, item, { reason, attemptId = null }) {
  if (!RECOVERY_OUTCOME_REASONS.includes(reason) ||
      (attemptId !== null && (typeof attemptId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(attemptId)))) {
    throw new TypeError('Invalid source recovery outcome');
  }
  let recorded = false;
  await store.withCurrentCapture(context, async client => {
    const result = await client.query(`UPDATE media_source_observations
      SET recovery_outcome=$6, recovery_completed_at=clock_timestamp()
      WHERE library_id=$1 AND media_server_id=$2 AND external_id=$3 AND generation=$4
        AND source_digest=$5 AND recovery_attempt_id IS NOT DISTINCT FROM $7::uuid
        AND recovery_completed_at IS NULL
        AND EXISTS (SELECT 1 FROM libraries WHERE id=$1 AND media_server_id=$2 AND is_active)
      RETURNING external_id`,
    [context.libraryId, context.mediaServerId, item.external_id, context.generation,
      item.source_identity_evidence?.snapshotDigest, reason, attemptId]);
    recorded = result.rowCount === 1;
  });
  return recorded;
}

/** Diagnostics never turn an otherwise safe sync into a failure. */
export function createSyncIdentityOutcomeRecorder(store, context, logger) {
  return async (item, outcome) => {
    try { return await recordSyncIdentityRecoveryOutcome(store, context, item, outcome); }
    catch {
      logger.warn('Source recovery outcome could not be recorded', { libraryId: context.libraryId },
        { dedupeKey: `identity-outcome:${context.libraryId}`, dedupeWindowMs: 3600000 });
      return false;
    }
  };
}
