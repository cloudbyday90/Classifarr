import { OMDB_FALLBACK_REASON } from './enrichmentRetryService.mjs';

export function isExpectedOmdbMiss(errorMessage) {
    const normalized = String(errorMessage || '').toLowerCase();
    return normalized.includes('omdb not found') ||
        normalized.includes('movie not found') ||
        normalized.includes('series not found') ||
        normalized.includes('error getting data');
}

export function isTransientOmdbTransportError(error) {
    const code = String(error?.code || '').toUpperCase();
    const normalized = String(error?.message || '').toLowerCase();
    const status = error?.response?.status;

    const isTransientHttpStatus =
        status === 408 ||
        status === 429 ||
        status === 502 ||
        status === 503 ||
        status === 504 ||
        (status >= 520 && status <= 527) ||
        status === 530;

    return isTransientHttpStatus ||
        code === 'ECONNABORTED' ||
        code === 'ETIMEDOUT' ||
        code === 'ECONNRESET' ||
        code === 'ENOTFOUND' ||
        code === 'EAI_AGAIN' ||
        normalized.includes('timeout') ||
        normalized.includes('socket hang up') ||
        normalized.includes('cloudflare');
}

export function buildOmdbFallbackReason(resultError) {
    if (isExpectedOmdbMiss(resultError)) {
        return 'OMDb not found';
    }

    if (!resultError) {
        return 'OMDb retry exhausted';
    }

    return `OMDb retry exhausted: ${String(resultError).slice(0, 80)}`;
}

export async function enrichWithOmdb({ db, omdbService, logger }, item) {
    try {
        let omdbResult = null;
        if (item.imdb_id) {
            omdbResult = await omdbService.getByIMDBId(item.imdb_id);
        }
        if (!omdbResult && item.title) {
            omdbResult = await omdbService.getByTitle(item.title, item.year, item.media_type);
        }

        if (omdbResult) {
            const omdbData = {
                data: omdbResult,
                fetched_at: new Date().toISOString()
            };

            await db.query(`
                UPDATE media_server_items 
                SET metadata = jsonb_set(
                    COALESCE(metadata, '{}'::jsonb),
                    '{omdb}',
                    $2::jsonb
                )
                WHERE id = $1
            `, [item.media_item_id, JSON.stringify(omdbData)]);

            logger.info('OMDb enrichment successful', { title: item.title, mediaItemId: item.media_item_id });
            return { success: true, data: omdbResult };
        }

        return { success: false, error: 'OMDb not found' };
    } catch (error) {
        if (isTransientOmdbTransportError(error)) {
            logger.warn('OMDb enrichment transient error', {
                item: item.title,
                error: error.message,
                code: error.code || null
            });
        } else {
            logger.error('OMDb enrichment failed', { error: error.message, item: item.title });
        }
        return { success: false, error: error.message };
    }
}

export async function handleOmdbFallback({ db, logger, enrichmentItemStateService, queueForRetry }, item, resultError, options = {}) {
    const { exhausted = false } = options;
    const fallbackReason = buildOmdbFallbackReason(resultError);

    await queueForRetry(item.media_item_id, 'tavily', fallbackReason, 5);

    const fallbackRowResult = await db.query(
        `SELECT id, status, reason
         FROM enrichment_retry_queue
         WHERE media_item_id = $1
           AND enrichment_type = 'tavily'
         LIMIT 1`,
        [item.media_item_id]
    );

    if (fallbackRowResult.rows.length === 0) {
        return false;
    }

    await db.query(
        `UPDATE enrichment_retry_queue
         SET status = 'skipped',
             attempts = GREATEST(attempts + 1, max_attempts),
             completed_at = NOW(),
             error_message = $2,
             reason = COALESCE(NULLIF(reason, ''), $3)
         WHERE id = $1`,
        [item.queue_id, resultError || 'OMDb not found', OMDB_FALLBACK_REASON]
    );
    await enrichmentItemStateService.syncItemState(item.media_item_id);

    const fallbackRow = fallbackRowResult.rows[0];
    const logPayload = {
        queueId: item.queue_id,
        mediaItemId: item.media_item_id,
        omdbError: resultError || 'OMDb not found',
        tavilyQueueId: fallbackRow.id,
        tavilyStatus: fallbackRow.status,
        tavilyReason: fallbackRow.reason || null
    };

    if (isExpectedOmdbMiss(resultError)) {
        logger.info(exhausted
            ? 'OMDb retry exhausted; item moved to Tavily fallback'
            : 'OMDb metadata miss; item moved to Tavily fallback', logPayload);
    } else {
        logger.warn('OMDb retry exhausted after operational errors; item moved to Tavily fallback', logPayload);
    }

    return true;
}
