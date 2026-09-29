/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { claimEnrichmentRetry, createEnrichmentRetryWriteGuard } from './enrichmentRetryClaimService.mjs';
import { persistEnrichmentRetryResult } from './enrichmentRetryResultPersistence.mjs';
import { prepareOmdbRetryBatch } from './omdbRetryBatchPlan.mjs';

export async function processRetryQueue(deps, limit = 50, enrichmentType = 'web_search') {
  const { db, logger, enrichWithOmdb, enrichWithWebSearch } = deps;
  if (!['omdb', 'web_search', 'tavily'].includes(enrichmentType)) throw new TypeError('unsupported_retry_type');
  if (!Number.isSafeInteger(limit) || limit < 0) throw new TypeError('invalid_retry_limit');
  const summary = { processed: 0, success: 0, failed: 0, autoFailed: 0, skipped: false };
  if (limit === 0) return summary;
  await deps.recoverStaleProcessingRetries(enrichmentType);
  await deps.normalizeTavilyMonthlyDeferredRows();
  await deps.resolveRetriesWithExistingMetadata(enrichmentType);
  summary.autoFailed = await deps.failExhaustedPendingRetries(enrichmentType);
  const visited = [];
  const plan = enrichmentType === 'omdb'
    ? await prepareOmdbRetryBatch(deps, limit)
    : await deps.prepareRetryBatch?.(enrichmentType, limit);
  try {
    while (visited.length < limit) {
      const candidateId = plan ? await plan.next() : null;
      if (plan && candidateId == null) {
        summary.skipped ||= plan.waiting === true;
        break;
      }
      const item = await claimEnrichmentRetry(db, enrichmentType, visited, candidateId);
      if (!item) { if (plan) continue; break; }
      visited.push(item.queue_id);
      Object.freeze(item);
      const write = createEnrichmentRetryWriteGuard(db, item, enrichmentType);
      let result;
      try {
        const ready = plan ? true : await deps.hasAvailableWebSearchProvider();
        result = !ready ? { success: false, waitForProvider: true }
          : enrichmentType === 'omdb' ? await enrichWithOmdb(item)
            : await enrichWithWebSearch(item, { enrichmentType });
      } catch (_error) {
        result = { success: false, error: 'retry_provider_unavailable', transient: true };
      }
      let outcome;
      try {
        outcome = await write((client, claim, current) =>
          persistEnrichmentRetryResult(client, claim, current, item, enrichmentType, result, deps));
      } catch (error) {
        if (error.reason === 'queue_claim_not_owned') {
          logger.debug('Discarded obsolete enrichment retry result', { queueId: item.queue_id, enrichmentType });
          continue;
        }
        // Do not turn an uncertain database commit into a second write or provider failure.
        logger.error('Enrichment retry persistence unavailable; lease recovery will retry', {
          queueId: item.queue_id, mediaItemId: item.media_item_id, enrichmentType,
          reason: 'retry_persistence_unavailable',
          databaseCode: /^[0-9A-Z]{5}$/.test(error.cause?.code ?? '') ? error.cause.code : null,
        });
        throw error;
      }
      summary.processed++;
      if (outcome === 'completed') summary.success++;
      if (outcome === 'failed' || outcome === 'pending') summary.failed++;
      if (outcome === 'fallback') deps.scheduleProcessing();
      logger.info('Enrichment retry result committed', { queueId: item.queue_id, mediaItemId: item.media_item_id, enrichmentType, outcome });
      if (outcome === 'deferred') summary.skipped = true;
      if (outcome !== 'source_changed' && (outcome === 'deferred' || result.transient)) {
        if (plan && result.providerAdmissionWait) {
          deps.scheduleProcessing(result.retryAfterSeconds * 1000);
          continue;
        }
        break;
      }
    }
  } finally { plan?.finish(); }
  logger.info('Retry queue processing complete', { ...summary, enrichmentType });
  return summary;
}
