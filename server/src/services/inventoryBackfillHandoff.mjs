/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readRefillCandidatePage, REFILL_QUEUE_BATCH_LIMIT } from './queueRefillCandidates.mjs';
import { INGESTION_OWNER_ACTIVE_SQL, INGESTION_UNFINISHED_MARKERS_SQL } from './libraryIngestionPredicates.mjs';
import { EnrichmentItemStateService } from './enrichmentItemStateService.mjs';
import { verifyNextIngestionRecovery } from './ingestionRecoveryVerification.mjs';

const PAGE_LIMIT = 250;

/** Retain the existing scan budget without holding one transaction for the entire pass. */
export async function drainInventoryBackfillHandoffs(deps, materializePage = materializeInventoryBackfillPage,
  verifyRecovery = verifyNextIngestionRecovery) {
  await verifyRecovery(deps);
  let result = null;
  for (let page = 0; page < REFILL_QUEUE_BATCH_LIMIT / PAGE_LIMIT; page++) {
    const next = await materializePage(deps);
    if (next === null) break;
    result ??= { queued: 0 };
    result.queued += next.queued;
  }
  return result;
}

/** One local transaction: no provider calls and no progress ahead of committed jobs. */
export async function materializeInventoryBackfillPage({ db, buildPayload, logger }) {
  return db.withTransaction(async client => {
    await client.query("SET LOCAL statement_timeout='10s'");
    await client.query("SET LOCAL lock_timeout='1s'");
    const { rows: [state] } = await client.query(`SELECT s.* FROM library_ingestion_state s
      JOIN libraries l ON l.id=s.library_id LEFT JOIN media_server ms ON ms.id=l.media_server_id
      WHERE s.phase='complete' AND l.is_active AND l.media_type IN ('movie','tv')
        AND (l.media_server_id IS NULL OR ms.is_active)
        AND (s.backfill_run_id IS DISTINCT FROM s.run_id OR s.backfill_completed_at IS NULL)
        AND NOT (${INGESTION_UNFINISHED_MARKERS_SQL} OR ${INGESTION_OWNER_ACTIVE_SQL})
      ORDER BY s.backfill_updated_at NULLS FIRST,s.library_id
      LIMIT 1 FOR UPDATE OF s SKIP LOCKED`);
    if (!state) return null;

    const cursor = state.backfill_run_id === state.run_id
      ? { afterId: state.backfill_after_id, throughId: state.backfill_through_id } : null;
    const page = await readRefillCandidatePage(client, cursor, null,
      { libraryId: state.library_id, batchLimit: PAGE_LIMIT });
    const payloads = page.rows.map(buildPayload);
    if (payloads.some(payload => !payload)) throw new Error('backfill_payload_invalid');
    // Candidate filtering and all writes share the generation row lock. Replayed
    // transactions cannot leave a checkpoint without jobs or publish partial jobs.
    const inserted = await client.query(`INSERT INTO task_queue(task_type,payload,priority,source,max_attempts)
      SELECT 'metadata_enrichment',value,5,'gap_analysis',5 FROM jsonb_array_elements($1::jsonb)
      RETURNING payload->>'itemId' AS item_id`, [JSON.stringify(payloads)]);
    const itemState = new EnrichmentItemStateService({ db: client, logger });
    const synced = await itemState.syncItemStates(inserted.rows.map(row => Number(row.item_id)));
    if (synced.length !== inserted.rowCount) throw new Error('backfill_item_state_unavailable');
    const checkpoint = await client.query(`UPDATE library_ingestion_state SET backfill_run_id=$2,backfill_after_id=$3,
      backfill_through_id=$4,backfill_completed_at=CASE WHEN $5 THEN clock_timestamp() ELSE NULL END,
      backfill_updated_at=clock_timestamp() WHERE library_id=$1 AND run_id=$2`,
    [state.library_id, state.run_id, page.cursor?.afterId ?? 0, page.cursor?.throughId ?? null, page.cursor === null]);
    if (checkpoint.rowCount !== 1) throw new Error('backfill_generation_changed');
    return { queued: inserted.rowCount };
  });
}
