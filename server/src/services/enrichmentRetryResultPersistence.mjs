/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { TAVILY_MONTHLY_DEFERRED_REASON, TAVILY_MONTHLY_DEFERRED_MESSAGE } from '../utils/enrichmentState.mjs';
import { buildOmdbFallbackReason, isExpectedOmdbMiss } from './enrichmentRetryOmdb.mjs';

/** Only called inside the received retry claim's write scope. No provider calls. */
export async function persistEnrichmentRetryResult(client, claim, sourceCurrent, item, type, result, deps) {
  const id = item.queue_id;
  let outcome;
  if (!sourceCurrent) {
    await client.query(`UPDATE enrichment_retry_queue SET status = 'pending', claim_token = NULL,
      claim_until = NULL, error_message = 'Source changed; awaiting a fresh retry', completed_at = NULL WHERE id = $1`, [id]);
    outcome = 'source_changed';
  } else if (result.success) {
    const metadataKey = type === 'omdb' ? 'omdb' : 'web_search_imdb';
    if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) throw new Error('retry_evidence_missing');
    const evidence = type === 'omdb' ? { data: result.data, fetched_at: new Date().toISOString() } : result.data;
    await client.query(`UPDATE media_server_items SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb),
      $2::text[], $3::jsonb) WHERE id = $1 AND metadata->$4::text IS NULL`,
    [item.media_item_id, [metadataKey], JSON.stringify(evidence), metadataKey]);
    await client.query(`UPDATE enrichment_retry_queue SET status = 'completed', completed_at = NOW(),
      claim_token = NULL, claim_until = NULL, error_message = NULL WHERE id = $1`, [id]);
    outcome = 'completed';
  } else if (type === 'tavily' && result.deferUntilMonthlyReset) {
    await client.query(`UPDATE enrichment_retry_queue SET status = 'pending', reason = $2, attempts = 0,
      completed_at = NULL, error_message = $3, claim_token = NULL, claim_until = NULL WHERE id = $1`,
    [id, TAVILY_MONTHLY_DEFERRED_REASON, TAVILY_MONTHLY_DEFERRED_MESSAGE]);
    outcome = 'deferred';
  } else {
    const exhausted = claim.attempts + 1 >= claim.max_attempts;
    const error = String(result.error || 'Unknown error').slice(0, 500);
    if (type === 'omdb' && (isExpectedOmdbMiss(error) || exhausted)) {
      await deps.queueForRetry(item.media_item_id, 'web_search', buildOmdbFallbackReason(error), 5, client);
      const fallback = await client.query(`SELECT id FROM enrichment_retry_queue
        WHERE media_item_id = $1 AND enrichment_type = 'web_search'`, [item.media_item_id]);
      if (!fallback.rows.length) throw new Error('retry_fallback_missing');
      await client.query(`UPDATE enrichment_retry_queue SET status = 'skipped',
        attempts = GREATEST(attempts + 1, max_attempts), completed_at = NOW(), error_message = $2,
        claim_token = NULL, claim_until = NULL WHERE id = $1`, [id, error]);
      outcome = 'fallback';
    } else {
      await client.query(`UPDATE enrichment_retry_queue
        SET status = CASE WHEN attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END,
          attempts = attempts + 1, error_message = $2,
          completed_at = CASE WHEN attempts + 1 >= max_attempts THEN NOW() ELSE NULL END,
          claim_token = NULL, claim_until = NULL WHERE id = $1`, [id, error]);
      outcome = exhausted ? 'failed' : 'pending';
    }
  }
  await deps.enrichmentItemStateService.syncItemState(item.media_item_id, client);
  return outcome;
}
