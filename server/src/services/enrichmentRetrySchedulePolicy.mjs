/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { persistScopedRetryWait } from './enrichmentRetryScopedWait.mjs';
const MIN_DELAY_MS = 60_000;
const MAX_DELAY_MS = 60 * 60_000;

/** Equal jitter keeps a nonzero floor; the sampled delay is persisted once. */
export function retryDelayMs(attempts, random = Math.random) {
  const exponent = Number.isSafeInteger(attempts) ? Math.max(0, Math.min(attempts, 6)) : 0;
  const ceiling = Math.min(MAX_DELAY_MS, MIN_DELAY_MS * 2 ** exponent);
  const sample = random();
  const jitter = Number.isFinite(sample) ? Math.max(0, Math.min(sample, 1)) : 1;
  return Math.ceil(ceiling / 2 + ceiling / 2 * jitter);
}

export function retryDependency(type) { return type === 'omdb' ? 'omdb' : 'web_search'; }

/** Fixed codes only: never persist an upstream payload, URL or credential here. */
export function retrySchedule(result, attempts) {
  if (result.providerAdmissionWait) {
    const seconds = Number.isFinite(result.retryAfterSeconds) && result.retryAfterSeconds > 0
      ? Math.max(1, Math.min(result.retryAfterSeconds, 30 * 86400)) : 60;
    return { delayMs: Math.ceil(seconds * 1000), chargeAttempt: false, cooldown: false, reason: 'provider_admission_wait' };
  }
  if (result.credentialsRejected) return { delayMs: MIN_DELAY_MS, chargeAttempt: false, cooldown: true, reason: 'provider_credentials_rejected' };
  if (result.waitForProvider) return { delayMs: MIN_DELAY_MS, chargeAttempt: false, cooldown: true, reason: 'provider_unavailable' };
  if (result.deferUntilDailyReset) return { reset: 'day', chargeAttempt: false, cooldown: true, reason: 'daily_quota' };
  if (result.deferUntilMonthlyReset) return { reset: 'month', chargeAttempt: false, cooldown: false, reason: 'monthly_quota' };
  const supplied = Number.isFinite(result.retryAfterSeconds) && result.retryAfterSeconds >= 0
    ? Math.min(result.retryAfterSeconds, 86_400) * 1000 : 0;
  return { delayMs: Math.max(retryDelayMs(attempts), supplied), chargeAttempt: true,
    cooldown: result.transient === true, reason: result.transient ? 'provider_transient' : 'item_retry' };
}

/** Called only inside the current claim's fenced result transaction. */
export async function persistRetrySchedule(client, queueId, type, schedule, result) {
  const { rows: [row] } = await client.query(`UPDATE enrichment_retry_queue SET next_attempt_at =
    CASE WHEN $2::text IS NOT NULL THEN
      (date_trunc($2::text, clock_timestamp() AT TIME ZONE 'UTC') +
        CASE WHEN $2 = 'month' THEN interval '1 month' ELSE interval '1 day' END) AT TIME ZONE 'UTC'
    ELSE clock_timestamp() + ($3 * interval '1 millisecond') END
    WHERE id = $1 RETURNING next_attempt_at`, [queueId, schedule.reset ?? null, schedule.delayMs ?? 0]);
  if (await persistScopedRetryWait(client, queueId, type, schedule, result)) return;
  if (schedule.cooldown) {
    if (!row?.next_attempt_at) throw new Error('retry_schedule_missing');
    await client.query(`INSERT INTO enrichment_retry_cooldowns (dependency, next_attempt_at, reason)
      VALUES ($1, $2, $3) ON CONFLICT (dependency) DO UPDATE
      SET next_attempt_at = GREATEST(enrichment_retry_cooldowns.next_attempt_at, EXCLUDED.next_attempt_at),
        reason = CASE WHEN EXCLUDED.next_attempt_at >= enrichment_retry_cooldowns.next_attempt_at
          THEN EXCLUDED.reason ELSE enrichment_retry_cooldowns.reason END`,
    [retryDependency(type), row.next_attempt_at, schedule.reason]);
  }
}
