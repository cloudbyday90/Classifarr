import {
    TAVILY_MONTHLY_DEFERRED_REASON,
    TAVILY_MONTHLY_DEFERRED_MESSAGE
} from '../utils/enrichmentState.mjs';
import { ENRICHMENT_RETRY_STALE_MS } from './enrichmentRetryClaimService.mjs';

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

export async function failExhaustedPendingRetries({ db, enrichmentItemStateService, logger }, enrichmentType = null) {
    const hasTypeFilter = typeof enrichmentType === 'string' && enrichmentType.trim().length > 0;
    const params = [TAVILY_MONTHLY_DEFERRED_REASON];
    const typeClause = hasTypeFilter ? 'AND enrichment_type = $2' : '';
    if (hasTypeFilter) {
        params.push(enrichmentType);
    }

    const result = await db.query(`
      UPDATE enrichment_retry_queue
      SET status = 'failed',
          completed_at = NOW(),
          error_message = COALESCE(error_message, 'Max attempts reached while pending')
      WHERE status = 'pending'
        AND attempts >= max_attempts
        AND NOT (enrichment_type = 'tavily' AND reason = $1)
        ${typeClause}
      RETURNING media_item_id
    `, params);

    if (result.rowCount > 0) {
        await enrichmentItemStateService.syncItemStates(result.rows.map((row) => row.media_item_id));
        logger.info('Auto-healed exhausted pending enrichment retries', {
            enrichmentType: hasTypeFilter ? enrichmentType : 'all',
            updated: result.rowCount
        });
    }

    return result.rowCount || 0;
}

export async function resolveRetriesWithExistingMetadata({ db, enrichmentItemStateService, logger }, enrichmentType = null) {
    const hasTypeFilter = typeof enrichmentType === 'string' && enrichmentType.trim().length > 0;
    const params = [];
    const typeClause = hasTypeFilter ? 'AND erq.enrichment_type = $1' : '';

    if (hasTypeFilter) {
        params.push(enrichmentType);
    }

    const result = await db.query(`
      UPDATE enrichment_retry_queue erq
      SET status = 'completed',
          claim_token = NULL, claim_until = NULL,
          completed_at = COALESCE(erq.completed_at, NOW()),
          error_message = COALESCE(erq.error_message, 'Auto-resolved: required enrichment metadata already present')
      FROM media_server_items msi
      WHERE erq.media_item_id = msi.id
        AND erq.status = 'pending'
        ${typeClause}
        AND (
          (erq.enrichment_type = 'omdb' AND msi.metadata->'omdb' IS NOT NULL)
          OR (erq.enrichment_type IN ('tavily', 'web_search') AND (
            msi.metadata->'tavily_imdb' IS NOT NULL
            OR msi.metadata->'tavily_advisory' IS NOT NULL
            OR msi.metadata->'web_search_imdb' IS NOT NULL
            OR msi.metadata->'web_search_advisory' IS NOT NULL
            OR msi.metadata->'omdb' IS NOT NULL
          ))
          OR (erq.enrichment_type = 'tmdb' AND msi.metadata->'tmdb' IS NOT NULL)
        )
      RETURNING erq.id, erq.media_item_id, erq.enrichment_type
    `, params);

    if (result.rowCount > 0) {
        await enrichmentItemStateService.syncItemStates(result.rows.map((row) => row.media_item_id));
        logger.info('Auto-resolved stale enrichment retry rows', {
            enrichmentType: hasTypeFilter ? enrichmentType : 'all',
            resolved: result.rowCount
        });
    }

    return result.rowCount || 0;
}

export async function normalizeTavilyMonthlyDeferredRows({ db, enrichmentItemStateService, logger }) {
    const result = await db.query(`
      UPDATE enrichment_retry_queue
      SET status = 'pending',
          reason = $1,
          attempts = 0,
          completed_at = NULL,
          error_message = $2
      WHERE enrichment_type = 'tavily'
        AND (
          (status IN ('failed', 'skipped') AND (
            reason = $1
            OR error_message ILIKE '%status code 432%'
            OR error_message ILIKE '%monthly quota%'
            OR error_message ILIKE '%quota reached%'
          ))
          OR (status = 'pending' AND attempts >= max_attempts AND (
            reason = $1
            OR error_message ILIKE '%status code 432%'
            OR error_message ILIKE '%monthly quota%'
            OR error_message ILIKE '%quota reached%'
          ))
        )
      RETURNING media_item_id
    `, [TAVILY_MONTHLY_DEFERRED_REASON, TAVILY_MONTHLY_DEFERRED_MESSAGE]);

    if (result.rowCount > 0) {
        await enrichmentItemStateService.syncItemStates(result.rows.map((row) => row.media_item_id));
        logger.info('Normalized Tavily monthly quota rows back to pending', {
            normalized: result.rowCount
        });
    }

    return result.rowCount || 0;
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
