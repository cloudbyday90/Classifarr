import {
    TAVILY_MONTHLY_DEFERRED_REASON,
    TAVILY_MONTHLY_DEFERRED_MESSAGE
} from '../utils/enrichmentState.mjs';

export async function processRetryQueue(deps, limit = 50, enrichmentType = 'web_search') {
    const {
        db, logger, enrichmentItemStateService,
        recoverStaleProcessingRetries, normalizeTavilyMonthlyDeferredRows,
        resolveRetriesWithExistingMetadata, failExhaustedPendingRetries,
        enrichWithOmdb, enrichWithWebSearch, hasAvailableWebSearchProvider,
        handleOmdbFallback, isExpectedOmdbMiss
    } = deps;

    await recoverStaleProcessingRetries(enrichmentType);
    await normalizeTavilyMonthlyDeferredRows();
    await resolveRetriesWithExistingMetadata(enrichmentType);
    const autoFailed = await failExhaustedPendingRetries(enrichmentType);

    if (['tavily', 'web_search'].includes(enrichmentType)) {
        if (!await hasAvailableWebSearchProvider()) {
            return {
                processed: 0,
                success: 0,
                failed: 0,
                autoFailed,
                skipped: true,
                reason: 'No web search provider is available'
            };
        }
        await normalizeTavilyMonthlyDeferredRows();
    }

    const processLimit = limit;

    const pendingResult = await db.query(`
      SELECT 
        erq.id as queue_id,
        erq.media_item_id,
        erq.attempts,
        erq.max_attempts,
        msi.title,
        msi.year,
        msi.tmdb_id,
        msi.imdb_id,
        msi.media_type
      FROM enrichment_retry_queue erq
      JOIN media_server_items msi ON erq.media_item_id = msi.id
      WHERE erq.status = 'pending' 
        AND erq.enrichment_type = $1
        AND erq.attempts < erq.max_attempts
        AND (
          (erq.enrichment_type <> 'omdb' OR msi.metadata->'omdb' IS NULL)
          AND (erq.enrichment_type NOT IN ('tavily', 'web_search') OR (
            msi.metadata->'tavily_imdb' IS NULL
            AND msi.metadata->'tavily_advisory' IS NULL
            AND msi.metadata->'web_search_imdb' IS NULL
            AND msi.metadata->'web_search_advisory' IS NULL
            AND msi.metadata->'omdb' IS NULL
          ))
          AND (erq.enrichment_type <> 'tmdb' OR msi.metadata->'tmdb' IS NULL)
        )
        AND (
          erq.enrichment_type <> 'tavily'
          OR erq.reason IS DISTINCT FROM $3
          OR date_trunc('month', COALESCE(erq.last_attempt_at, erq.created_at)) < date_trunc('month', NOW())
        )
      ORDER BY erq.priority ASC, erq.created_at ASC
      LIMIT $2
    `, [enrichmentType, processLimit, TAVILY_MONTHLY_DEFERRED_REASON]);

    if (pendingResult.rows.length === 0) {
        logger.info('No pending items in retry queue', { enrichmentType });
        return { processed: 0, success: 0, failed: 0, autoFailed, skipped: false };
    }

    let processed = 0;
    let success = 0;
    let failed = 0;

    for (const item of pendingResult.rows) {
        try {
            await db.query(
                `UPDATE enrichment_retry_queue SET status = 'processing', last_attempt_at = NOW() WHERE id = $1`,
                [item.queue_id]
            );

            let result;
            if (enrichmentType === 'omdb') {
                result = await enrichWithOmdb(item);
            } else {
                result = await enrichWithWebSearch(item, { enrichmentType });
            }

            if (result.success) {
                await db.query(
                    `UPDATE enrichment_retry_queue SET status = 'completed', completed_at = NOW() WHERE id = $1`,
                    [item.queue_id]
                );
                await enrichmentItemStateService.syncItemState(item.media_item_id);

                success++;
                logger.info('Web search enrichment successful', { title: item.title, mediaItemId: item.media_item_id });
            } else if (result.deferUntilMonthlyReset) {
                await db.query(
                    `UPDATE enrichment_retry_queue
             SET status = 'pending',
                 reason = $2,
                 attempts = 0,
                 completed_at = NULL,
                 error_message = $3
             WHERE id = $1`,
                    [item.queue_id, TAVILY_MONTHLY_DEFERRED_REASON, TAVILY_MONTHLY_DEFERRED_MESSAGE]
                );
                await enrichmentItemStateService.syncItemState(item.media_item_id);
                logger.info('Deferred legacy Tavily retry item until monthly quota reset', {
                    queueId: item.queue_id,
                    title: item.title
                });
            } else {
                const nextAttempts = (item.attempts || 0) + 1;
                const exhausted = nextAttempts >= (item.max_attempts || 0);
                const resultError = result.error || 'Unknown error';

                if (enrichmentType === 'omdb' && isExpectedOmdbMiss(resultError)) {
                    const handledByFallback = await handleOmdbFallback(item, resultError, { exhausted: false });
                    if (handledByFallback) {
                        processed++;
                        continue;
                    }
                }

                if (enrichmentType === 'omdb' && exhausted) {
                    const handledByFallback = await handleOmdbFallback(item, resultError, { exhausted: true });
                    if (handledByFallback) {
                        processed++;
                        continue;
                    }
                }

                await db.query(
                    `UPDATE enrichment_retry_queue 
             SET status = CASE WHEN attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END,
                 attempts = attempts + 1,
                 error_message = $2
             WHERE id = $1`,
                    [item.queue_id, resultError]
                );
                await enrichmentItemStateService.syncItemState(item.media_item_id);

                if (exhausted) {
                    logger.error('Enrichment retry exhausted without required metadata', {
                        queueId: item.queue_id,
                        mediaItemId: item.media_item_id,
                        enrichmentType,
                        error: resultError
                    });
                } else {
                    logger.info('Enrichment retry failed; item remains pending', {
                        queueId: item.queue_id,
                        mediaItemId: item.media_item_id,
                        enrichmentType,
                        attempts: nextAttempts,
                        maxAttempts: item.max_attempts,
                        error: resultError
                    });
                }
                failed++;
            }

            processed++;
        } catch (error) {
            logger.error('Error processing retry queue item', { error: error.message, item });
            await db.query(
                `UPDATE enrichment_retry_queue 
           SET status = CASE WHEN attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END,
               attempts = attempts + 1,
               completed_at = CASE WHEN attempts + 1 >= max_attempts THEN NOW() ELSE completed_at END,
               error_message = $2 
           WHERE id = $1`,
                [item.queue_id, error.message]
            );
            await enrichmentItemStateService.syncItemState(item.media_item_id);
            failed++;
            processed++;
        }
    }

    logger.info('Retry queue processing complete', { processed, success, failed, autoFailed, enrichmentType });
    return { processed, success, failed, autoFailed, skipped: false };
}
