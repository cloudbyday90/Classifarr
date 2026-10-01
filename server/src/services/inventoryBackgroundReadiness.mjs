/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { INGESTION_OWNER_ACTIVE_SQL, INGESTION_UNFINISHED_MARKERS_SQL } from './libraryIngestionPredicates.mjs';

const inventoryReadinessSql = (requireRag, excludeTask = false, requireInventory = true) => `WITH active_libraries AS MATERIALIZED (
    SELECT l.id,l.media_server_id FROM libraries l LEFT JOIN media_server ms ON ms.id=l.media_server_id
    WHERE l.is_active AND l.media_type IN ('movie','tv') AND (l.media_server_id IS NULL OR ms.is_active)
)
SELECT CASE
    ${requireRag ? "WHEN NOT EXISTS (SELECT 1 FROM ai_provider_config WHERE id=1 AND rag_enabled) THEN 'disabled'" : ''}
    ${requireInventory ? "WHEN NOT EXISTS (SELECT 1 FROM active_libraries) THEN 'waiting_for_libraries'" : ''}
    WHEN EXISTS (SELECT 1 FROM active_libraries l WHERE ${INGESTION_UNFINISHED_MARKERS_SQL} OR ${INGESTION_OWNER_ACTIVE_SQL})
      OR EXISTS (SELECT 1 FROM library_ingestion_state s JOIN active_libraries l ON l.id=s.library_id WHERE s.phase<>'complete')
      THEN 'ingesting'
    ${requireInventory ? `WHEN NOT EXISTS (SELECT 1 FROM media_server_items i JOIN active_libraries l ON l.id=i.library_id
      WHERE i.media_type IN ('movie','tv')) THEN 'waiting_for_inventory'` : ''}
    WHEN EXISTS (SELECT 1 FROM active_libraries l LEFT JOIN library_ingestion_state s ON s.library_id=l.id
      WHERE l.media_server_id IS NOT NULL AND s.library_id IS NULL) THEN 'ingesting'
    WHEN EXISTS (SELECT 1 FROM library_ingestion_state s JOIN active_libraries l ON l.id=s.library_id
      WHERE s.backfill_run_id IS DISTINCT FROM s.run_id OR s.backfill_completed_at IS NULL) THEN 'backfilling'
    WHEN EXISTS (SELECT 1 FROM task_queue WHERE ${excludeTask ? 'id IS DISTINCT FROM $1::bigint AND ' : ''}(status='processing'
      OR (status='pending' AND (next_retry_at IS NULL OR next_retry_at<=statement_timestamp())))) THEN 'backfilling'
    ELSE 'ready' END AS readiness`;

export const INVENTORY_BACKGROUND_READINESS_SQL = inventoryReadinessSql(true);
// Maintenance must exclude only its own already-claimed task, never other active work.
export const INVENTORY_BACKGROUND_READINESS_EXCLUDING_TASK_SQL = inventoryReadinessSql(true, true);
// Manual maintenance may have no inventory, but never bypasses ingestion or other due work.
export const INVENTORY_MAINTENANCE_IDLE_SQL = inventoryReadinessSql(false, true, false);
const CAPABILITY_BACKGROUND_READINESS_SQL = inventoryReadinessSql(false);

export async function readInventoryBackgroundReadiness(database, { requireRag = true } = {}) {
    if (typeof requireRag !== 'boolean') throw new TypeError('Invalid readiness policy');
    return database.withTransaction(async client => {
        await client.query("SET LOCAL statement_timeout='3s'");
        return (await client.query(requireRag ? INVENTORY_BACKGROUND_READINESS_SQL : CAPABILITY_BACKGROUND_READINESS_SQL)).rows[0]?.readiness ?? 'unavailable';
    });
}

/** Cheap demand probe before cache scans, heavy locks, model clients or evaluation writes. */
export function withInventoryBackgroundReadiness(worker, database, read = readInventoryBackgroundReadiness) {
    let stopped = false, active = null;
    return { ...worker,
        stop() { stopped = true; worker.stop(); },
        run(...args) {
            if (stopped) return Promise.resolve({ status: 'stopped' });
            active ??= (async () => {
                let reason;
                try { reason = await read(database); }
                catch { reason = 'unavailable'; }
                if (stopped) return { status: 'stopped' };
                if (reason !== 'ready') return { status: 'deferred', reason };
                return worker.run(...args);
            })().finally(() => { active = null; });
            return active;
        },
    };
}
