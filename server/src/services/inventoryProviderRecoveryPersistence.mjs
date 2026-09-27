/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { ENRICHMENT_SOURCE_SQL, encodeEnrichmentSource } from './queueEnrichmentSourceGuard.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS, sourceConflictAuthorityExclusionForMediaServerItem } from './sourceConflictAuthorityGuard.mjs';

/** A short lease fences late completion without holding locks across provider I/O. */
export async function claimInventoryProviderRecovery(query, payload, tmdbId) {
    const type = payload.media.media_type;
    const source = encodeEnrichmentSource(payload.source_identity_snapshot, type, payload.source_library_id);
    if (!source) return null;
    const token = randomUUID();
    const result = await query(`UPDATE media_server_items AS msi
        SET inventory_tmdb_lease_id = $1::uuid, inventory_tmdb_lease_until = clock_timestamp() + interval '5 minutes'
        WHERE msi.id = $2 AND msi.tmdb_id = $3 AND msi.media_type = $4 AND msi.library_id = $5
          AND ${ENRICHMENT_SOURCE_SQL} = $6::jsonb
          AND ${sourceConflictAuthorityExclusionForMediaServerItem('$7')}
          AND EXISTS (SELECT 1 FROM libraries l WHERE l.id = msi.library_id AND l.is_active = true)
          AND (inventory_tmdb_lease_until IS NULL OR inventory_tmdb_lease_until <= clock_timestamp())
          AND (inventory_tmdb_retry_after IS NULL OR inventory_tmdb_retry_after <= clock_timestamp())
          AND inventory_tmdb_attempted_at IS NOT DISTINCT FROM $8::timestamptz
        RETURNING inventory_tmdb_recovery`, // sql-interpolation: fixed source projection, bound values
    [token, payload.itemId, tmdbId, type, payload.source_library_id, source,
        SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS, payload.inventory_tmdb_attempted_at ?? null]);
    return result.rowCount === 1 ? { token, previous: result.rows[0].inventory_tmdb_recovery } : null;
}
