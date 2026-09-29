/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { RETRY_MAINTENANCE_OPERATIONS } from './enrichmentRetryMaintenanceQueries.mjs';
import { TAVILY_MONTHLY_DEFERRED_REASON, TAVILY_MONTHLY_DEFERRED_MESSAGE } from '../utils/enrichmentState.mjs';

/** One database-only batch. A failed derived-state write must roll back retry changes. */
export async function runRetryMaintenanceBatch({ db, enrichmentItemStateService, logger }, operation, type = null) {
  if (!Object.hasOwn(RETRY_MAINTENANCE_OPERATIONS, operation)) throw new TypeError('unsupported_retry_maintenance');
  if (type !== null && !['omdb', 'web_search', 'tavily', 'tmdb'].includes(type)) throw new TypeError('unsupported_retry_type');
  const sql = RETRY_MAINTENANCE_OPERATIONS[operation];
  const params = [type, TAVILY_MONTHLY_DEFERRED_REASON, TAVILY_MONTHLY_DEFERRED_MESSAGE];
  const started = performance.now();
  const count = await db.withTransaction(async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await client.query("SET LOCAL lock_timeout = '2s'");
    await client.query("SET LOCAL statement_timeout = '10s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '10s'");
    await client.query("SET LOCAL transaction_timeout = '15s'");
    const candidates = (await client.query(sql.select, params)).rows;
    if (!candidates.length) return 0;
    const itemIds = [...new Set(candidates.map(row => row.media_item_id))].sort((a, b) => a - b);
    const locked = (await client.query(`SELECT id FROM media_server_items
      WHERE id = ANY($1::integer[]) ORDER BY id FOR UPDATE SKIP LOCKED`, [itemIds])).rows;
    if (!locked.length) return 0;
    // Fresh statement rechecks metadata after acquiring media locks, not the old selection snapshot.
    const updated = (await client.query(sql.update, [...params, candidates.map(row => row.id), locked.map(row => row.id)])).rows;
    for (const id of [...new Set(updated.map(row => row.media_item_id))].sort((a, b) => a - b)) {
      const state = await enrichmentItemStateService.syncItemState(id, client);
      if (state?.id !== id) throw new Error('retry_maintenance_state_missing');
    }
    return updated.length;
  });
  if (count) logger.info('Enrichment retry maintenance batch committed', {
    operation, enrichmentType: type ?? 'all', updated: count, durationMs: Math.round(performance.now() - started),
  });
  return count;
}
