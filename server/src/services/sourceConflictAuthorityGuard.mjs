/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { SOURCE_OBSERVATION_LIMITS } from './mediaSourceObservationContract.mjs';

export const SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS = SOURCE_OBSERVATION_LIMITS.retentionDays;
export const SOURCE_CONFLICT_AUTHORITY_BLOCK_REASON = 'current_source_identity_conflict';

/**
 * A recent recorded source conflict is positive disqualifying evidence. Capture
 * completeness can clear a conflict only by removing its observation; it never
 * turns an unresolved observation into authority through absence or omission.
 */
function sourceConflictLookup(retentionParameter) {
  if (!/^\$[1-9]\d*$/.test(retentionParameter)) throw new Error('Invalid source conflict retention parameter');
  return `
    SELECT 1 FROM media_source_observations AS source_conflict
    WHERE source_conflict.library_id = msi.library_id
      AND source_conflict.media_server_id = msi.media_server_id
      AND source_conflict.external_id = msi.external_id
      AND source_conflict.last_seen_at >= statement_timestamp()
        - ${retentionParameter}::integer * INTERVAL '1 day'
  `;
}

export function sourceConflictAuthorityPredicateForMediaServerItem(retentionParameter) {
  return `EXISTS (${sourceConflictLookup(retentionParameter)})`;
}

/** Page planning uses a correlated point lookup; write guards retain their existing EXISTS shape. */
export function sourceConflictPageExclusionForMediaServerItem(retentionParameter) {
  return `(${sourceConflictLookup(retentionParameter)} LIMIT 1) IS NULL`;
}

export function sourceConflictAuthorityExclusionForMediaServerItem(retentionParameter) {
  return `NOT ${sourceConflictAuthorityPredicateForMediaServerItem(retentionParameter)}`;
}
