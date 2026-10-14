/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { requireReviewActor } from './mediaIdentityReviewRepository.mjs';
import { assessRepairRetry } from './queueIdentityRepairEligibility.mjs';

/** Advisory snapshot, never a reservation or retry authority. No provider HTTP. */
export async function readRepairBackfillPage({ db, readProvider, actorId, cursor, signal }) {
  return db.withTransaction(async tx => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await tx.query("SET LOCAL lock_timeout = '1s'");
    await tx.query("SET LOCAL statement_timeout = '3s'");
    await tx.query("SET LOCAL transaction_timeout = '5s'");
    await requireReviewActor(tx, actorId);
    const { rows: [clock] } = await tx.query('SELECT transaction_timestamp() AS "checkedAt"');
    const { rows } = await tx.query(`SELECT r.id,r.task_id::text AS task_id,r.old_tmdb_id,r.new_tmdb_id,
      r.media_type,left(r.candidate->>'title',500) AS title,r.confirmed_at,
      r.provider_revision,r.attempts,r.max_attempts,r.repaired_version
      FROM queue_identity_repair_receipts r JOIN task_queue t ON t.id=r.task_id
      WHERE r.task_id>$1 AND r.retried_at IS NULL AND t.status='failed'
      ORDER BY r.task_id LIMIT 21`, [cursor]);
    signal?.throwIfAborted();
    const provider = rows.length ? (await readProvider(tx) ?? null) : null;
    const items = [];
    for (const receipt of rows.slice(0, 20)) {
      signal?.throwIfAborted();
      const { reason, error } = await assessRepairRetry(tx, receipt.task_id, receipt, provider);
      items.push({ receiptId: receipt.id, taskId: receipt.task_id, oldTmdbId: receipt.old_tmdb_id,
        newTmdbId: receipt.new_tmdb_id, mediaType: receipt.media_type, title: receipt.title,
        confirmedAt: receipt.confirmed_at, readiness: { status: error ? 'blocked' : 'ready', reason } });
    }
    signal?.throwIfAborted();
    return { items, nextCursor: rows.length > 20 ? rows[19].task_id : null, checkedAt: clock.checkedAt };
  });
}
