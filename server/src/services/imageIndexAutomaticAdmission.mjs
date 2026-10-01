/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readImageIndexReadiness } from './imageIndexReadiness.mjs';
import { imageIndexClaimRemaining } from './imageIndexMaintenanceClaims.mjs';

/** Called under the executor's runtime + index session locks, before any DDL. */
export async function admitAutomaticImageIndexAttempt(query, task) {
  const row = (await query('SELECT source FROM public.task_queue WHERE id = $1', [task.id])).rows[0];
  if (row?.source !== 'image_index_reconciliation') return { status: 'manual' };
  await query('BEGIN');
  try {
    await query("SET LOCAL transaction_timeout = '8s'");
    const readiness = await readImageIndexReadiness(query, task.id);
    let result = { status: 'deferred', reason: readiness };
    if (readiness === 'ready') {
      await imageIndexClaimRemaining(query, task);
      const state = (await query(`SELECT task_id, attempts, next_attempt_at > clock_timestamp() AS cooling_down
        FROM public.image_index_reconciliation_state WHERE singleton FOR UPDATE`)).rows[0];
      if (!state || String(state.task_id) !== String(task.id) || state.attempts >= 3) {
        result = { status: 'review', reason: 'attempt_limit_or_lost_episode' };
      } else if (state.cooling_down) result = { status: 'deferred', reason: 'cooldown' };
      else {
        await query(`UPDATE public.image_index_reconciliation_state SET attempts = attempts + 1,
          next_attempt_at = clock_timestamp() + INTERVAL '1 hour', last_result = 'running' WHERE singleton`);
        result = { status: 'admitted' };
      }
    }
    await query('COMMIT');
    return result;
  } catch (error) {
    try { await query('ROLLBACK'); } catch { /* The executor discards this session. */ }
    throw error;
  }
}
