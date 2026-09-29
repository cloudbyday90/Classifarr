/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { TAVILY_MONTHLY_DEFERRED_REASON } from '../utils/enrichmentState.mjs';
import { ENRICHMENT_RETRY_STALE_MS } from './enrichmentRetryClaimService.mjs';
import { runRetryMaintenanceBatch } from './enrichmentRetryMaintenanceBatch.mjs';

export async function recoverStaleProcessingRetries({ db, enrichmentItemStateService, logger }, enrichmentType = null) {
    const hasTypeFilter = typeof enrichmentType === 'string' && enrichmentType.trim().length > 0;
    const result = await db.withTransaction(async client => {
        await client.query("SET LOCAL lock_timeout = '2s'");
        await client.query("SET LOCAL statement_timeout = '10s'");
        await client.query("SET LOCAL idle_in_transaction_session_timeout = '10s'");
        await client.query("SET LOCAL transaction_timeout = '15s'");
        const updated = await client.query(`WITH expired AS (
          SELECT id FROM enrichment_retry_queue WHERE status = 'processing'
            AND claim_token IS NOT NULL AND claim_until <= clock_timestamp()
            AND ($1::text IS NULL OR enrichment_type = $1)
          ORDER BY claim_until, id LIMIT 50 FOR UPDATE SKIP LOCKED
        ) UPDATE enrichment_retry_queue erq
          SET status = CASE WHEN attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END,
            attempts = LEAST(attempts + 1, max_attempts),
            completed_at = CASE WHEN attempts + 1 >= max_attempts THEN NOW() ELSE NULL END,
            error_message = COALESCE(error_message, 'Recovered expired processing retry'),
            last_attempt_at = NOW(), claim_token = NULL, claim_until = NULL
          FROM expired WHERE erq.id = expired.id RETURNING erq.id, media_item_id, enrichment_type`,
        [hasTypeFilter ? enrichmentType : null]);
        for (const id of new Set(updated.rows.map(row => row.media_item_id))) {
            await enrichmentItemStateService.syncItemState(id, client);
        }
        return updated;
    });

    if (result.rowCount > 0) {
        logger.warn('Recovered stale enrichment retry rows', {
            count: result.rowCount,
            enrichmentType: hasTypeFilter ? enrichmentType : 'all',
            thresholdMs: ENRICHMENT_RETRY_STALE_MS,
            queueIds: result.rows.slice(0, 20).map(row => row.id)
        });
    }

    return result.rowCount || 0;
}

export function failExhaustedPendingRetries(deps, enrichmentType = null) {
    return runRetryMaintenanceBatch(deps, 'exhausted', enrichmentType);
}

export function resolveRetriesWithExistingMetadata(deps, enrichmentType = null) {
    return runRetryMaintenanceBatch(deps, 'completed', enrichmentType);
}

export function normalizeTavilyMonthlyDeferredRows(deps) {
    return runRetryMaintenanceBatch(deps, 'monthly', 'tavily');
}

export async function countTavilyMonthlyDeferredRows({ db }) {
    const result = await db.query(`
      SELECT COUNT(*) AS count
      FROM enrichment_retry_queue
      WHERE enrichment_type = 'tavily'
        AND status = 'pending'
        AND reason = $1
    `, [TAVILY_MONTHLY_DEFERRED_REASON]);

    return parseInt(result.rows[0]?.count, 10) || 0;
}
