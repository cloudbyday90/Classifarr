/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { OBSERVATION_INVENTORY_CTES, OBSERVATION_SNAPSHOT_FIELDS } from './libraryObservationSnapshotSql.mjs';
export const OBSERVATION_HEALTH_LIMITS = Object.freeze({ libraryLimit: 12, rowLimit: 20000, observationByteLimit: 4096 });

/** Immediate combined health preserves its original bounded population contract. */
export async function readLibraryObservationHealthSnapshot(db) {
    const { libraryLimit, rowLimit, observationByteLimit } = OBSERVATION_HEALTH_LIMITS;
    const { rows } = await db.query(`WITH selected_libraries AS MATERIALIZED (
        SELECT id, name FROM libraries WHERE is_active = true ORDER BY id LIMIT $1
    ), bounded_ids AS MATERIALIZED (
        SELECT msi.id FROM media_server_items msi JOIN selected_libraries l ON l.id = msi.library_id
        ORDER BY msi.id LIMIT $2
    ), ${OBSERVATION_INVENTORY_CTES} SELECT ${OBSERVATION_SNAPSHOT_FIELDS}`,
    [libraryLimit, rowLimit + 1, rowLimit, observationByteLimit]);
    return rows[0];
}
