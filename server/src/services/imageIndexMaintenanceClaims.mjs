/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isQueueClaimToken } from './queueTaskAcknowledgementService.mjs';
import { claimNotOwned } from './queueClaimWriteGuard.mjs';

export function captureImageIndexClaim(task) {
  const id = task?.id, claim_token = task?.claim_token;
  if (!isQueueClaimToken(claim_token) || !/^[1-9][0-9]{0,18}$/.test(String(id))) throw claimNotOwned();
  return Object.freeze({ id, claim_token });
}

export async function claimNextImageIndexTask(query) {
  const result = await query(`UPDATE public.task_queue SET status = 'processing',
    started_at = NOW(), claim_token = gen_random_uuid(), visible_at = clock_timestamp() + INTERVAL '150 seconds'
    WHERE id = (SELECT id FROM public.task_queue WHERE task_type = 'rebuild_hnsw_index'
      AND attempts < max_attempts AND ((status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= NOW()))
        OR (status = 'processing' AND visible_at <= clock_timestamp()))
      ORDER BY priority DESC, created_at, id LIMIT 1 FOR UPDATE SKIP LOCKED)
    RETURNING id, claim_token`);
  return result.rows[0] ?? null;
}

export async function imageIndexClaimRemaining(query, task) {
  const { rows: [row] } = await query(`SELECT EXTRACT(EPOCH FROM (visible_at - clock_timestamp())) * 1000 AS remaining
    FROM public.task_queue WHERE id = $1 AND claim_token = $2::uuid
      AND status = 'processing' AND task_type = 'rebuild_hnsw_index'`, [task.id, task.claim_token]);
  const remaining = Number(row?.remaining);
  if (!Number.isFinite(remaining) || remaining <= 100) throw claimNotOwned();
  return Math.floor(remaining - 100);
}

/** Short queue-only transaction; never wrap concurrent DDL in this scope. */
export async function finishImageIndexClaim(query, task, { status, result = null }) {
  await query('BEGIN');
  try {
    await query("SET LOCAL transaction_timeout = '5s'");
    const locked = await query(`SELECT id FROM public.task_queue WHERE id = $1 AND claim_token = $2::uuid
      AND status = 'processing' AND task_type = 'rebuild_hnsw_index' FOR UPDATE`, [task.id, task.claim_token]);
    if (!locked.rows.length) throw claimNotOwned();
    await imageIndexClaimRemaining(query, task);
    const update = await query(`UPDATE public.task_queue SET
      status = CASE WHEN $3 = 'complete' THEN 'completed'
        WHEN $3 = 'failed' AND attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END,
      attempts = attempts + CASE WHEN $3 = 'failed' THEN 1 ELSE 0 END,
      error_message = CASE WHEN $3 = 'complete' THEN NULL
        WHEN $3 = 'failed' THEN 'task_processing_failed' ELSE 'image_index_maintenance_busy' END,
      completed_at = CASE WHEN $3 = 'complete' OR ($3 = 'failed' AND attempts + 1 >= max_attempts) THEN NOW() ELSE NULL END,
      started_at = NULL, visible_at = NULL, claim_token = NULL,
      next_retry_at = CASE WHEN $3 = 'complete' THEN NULL ELSE NOW() + INTERVAL '60 seconds' END,
      payload = CASE WHEN $3 = 'complete' THEN payload || $4::jsonb ELSE payload END
      WHERE id = $1 AND claim_token = $2::uuid AND status = 'processing'
        AND task_type = 'rebuild_hnsw_index' AND visible_at > clock_timestamp() RETURNING id`,
    [task.id, task.claim_token, status, JSON.stringify({ result })]);
    if (!update.rows.length) throw claimNotOwned();
    await query('COMMIT');
  } catch (error) {
    try { await query('ROLLBACK'); } catch { /* Session owner discards the connection. */ }
    throw error;
  }
}
