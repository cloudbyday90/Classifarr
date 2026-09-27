/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const INVENTORY_BACKGROUND_READINESS_SQL = `WITH active_libraries AS MATERIALIZED (
    SELECT l.id FROM libraries l LEFT JOIN media_server ms ON ms.id=l.media_server_id
    WHERE l.is_active AND l.media_type IN ('movie','tv') AND (l.media_server_id IS NULL OR ms.is_active)
), latest_sync AS (
    SELECT DISTINCT ON (s.library_id) s.status FROM media_server_sync_status s
    JOIN active_libraries l ON l.id=s.library_id ORDER BY s.library_id,s.created_at DESC,s.id DESC
)
SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM ai_provider_config WHERE id=1 AND rag_enabled) THEN 'disabled'
    WHEN NOT EXISTS (SELECT 1 FROM active_libraries) THEN 'waiting_for_libraries'
    WHEN EXISTS (SELECT 1 FROM latest_sync WHERE status IN ('pending','running'))
      OR EXISTS (SELECT 1 FROM library_ingestion_state s JOIN active_libraries l ON l.id=s.library_id WHERE s.phase<>'complete')
      OR EXISTS (SELECT 1 FROM media_source_capture_state c JOIN active_libraries l ON l.id=c.library_id WHERE c.phase='collecting') THEN 'ingesting'
    WHEN NOT EXISTS (SELECT 1 FROM media_server_items i JOIN active_libraries l ON l.id=i.library_id
      WHERE i.media_type IN ('movie','tv')) THEN 'waiting_for_inventory'
    WHEN EXISTS (SELECT 1 FROM task_queue WHERE status='processing'
      OR (status='pending' AND (next_retry_at IS NULL OR next_retry_at<=statement_timestamp()))) THEN 'backfilling'
    ELSE 'ready' END AS readiness`;

export async function readInventoryBackgroundReadiness(database) {
    return database.withTransaction(async client => {
        await client.query("SET LOCAL statement_timeout='3s'");
        return (await client.query(INVENTORY_BACKGROUND_READINESS_SQL)).rows[0]?.readiness ?? 'unavailable';
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
