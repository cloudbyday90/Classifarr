/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildClassificationRoutingMetadataUpdate } from './classificationRoutingMetadataPersistence.mjs';

export const MANUAL_ROUTING_PENDING = 'manual_routing_pending';
export const MANUAL_ROUTING_MESSAGE = 'Selection saved. Routing is unconfirmed; check History and Radarr/Sonarr before retrying.';
const failureReasons = new Set(['arr_add_failed', 'no_mapping', 'missing_arr_id', 'config_missing_or_inactive',
  'missing_required_settings', 'missing_tvdb_id', 'lookup_no_series', 'lookup_missing_title', 'unsupported_arr_type']);

/** Provider errors may contain credentials. Persist only a fixed public contract. */
export function normalizeManualRoutingOutcome(result) {
  const arrType = ['radarr', 'sonarr'].includes(result?.arrType) ? result.arrType : null;
  const routed = result?.attempted === true && result?.routed === true && arrType !== null
    && ['routed', 'already_in_arr'].includes(result?.reason);
  return {
    attempted: result?.attempted === true,
    routed, arrType,
    reason: routed ? result.reason : failureReasons.has(result?.reason) ? result.reason : 'unexpected_error',
    error: routed ? null : MANUAL_ROUTING_MESSAGE,
  };
}

export async function recordManualRoutingOutcome(db, selection, routing) {
  const statement = buildClassificationRoutingMetadataUpdate({
    classificationId: selection.classificationId,
    routing: routing.routed ? 'routed' : routing.reason,
    routingError: routing.error,
    status: routing.routed ? 'routed' : null,
  });
  const result = await db.query( // sql-interpolation: trusted fixed SQL builder and guard clauses; all runtime values are bound.
    `${statement.text}
    AND library_id=$5 AND status='completed'
    AND metadata->'classification_details'->>'routing'=$6
    AND metadata->'classification_details'->>'manual_routing_attempt_id'=$7`,
  [...statement.values, selection.library.id, MANUAL_ROUTING_PENDING, selection.attemptId]);
  return result.rowCount === 1;
}
