/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { lockWebSearchProvider, webSearchPacingWait, advanceWebSearchPacing } from './webSearchPacingStore.mjs';
const providers = new Set(['tavily', 'brave', 'serper']);

export function webSearchRequestCost(provider, config = {}) {
  if (!providers.has(provider)) throw new TypeError('unknown_web_search_provider');
  const depth = String(config.searchDepth ?? config.config?.searchDepth ?? 'basic').trim().toLowerCase();
  return provider === 'tavily' && depth === 'advanced' ? 2 : 1;
}

/** Configuration lock must precede this shared transaction lock. Never hold it over HTTP. */
export async function reserveWebSearchQuota(client, { provider, config, context, costUnits, purpose = 'classification', operation = 'search' }) {
  if (!providers.has(provider) || ![1, 2].includes(costUnits)) throw new TypeError('invalid_quota_reservation');
  await client.query("SET LOCAL lock_timeout='1s'");
  await client.query("SET LOCAL statement_timeout='5s'");
  await client.query("SET LOCAL TIME ZONE 'UTC'");
  await lockWebSearchProvider(client, provider);
  const pacingWait = await webSearchPacingWait(client, provider, context);
  if (pacingWait > 0) return { allowed: false, retryAfterSeconds: pacingWait };
  const { rows: [usage] } = await client.query(`WITH boundary AS (SELECT clock_timestamp() AS now)
    SELECT COALESCE(sum(cost_units) FILTER (WHERE searched_at>=date_trunc('day',b.now)),0)::bigint AS daily,
      COALESCE(sum(cost_units),0)::bigint AS monthly,
      EXTRACT(epoch FROM date_trunc('day',b.now)+interval '1 day'-b.now) AS day_wait,
      EXTRACT(epoch FROM date_trunc('month',b.now)+interval '1 month'-b.now) AS month_wait
    FROM boundary b LEFT JOIN web_search_provider_usage u ON u.provider_key=$1
      AND u.searched_at>=date_trunc('month',b.now) GROUP BY b.now`, [provider]);
  let wait = 0;
  for (const [limit, used, seconds] of [[config.soft_daily_limit, usage.daily, usage.day_wait],
    [config.soft_monthly_limit, usage.monthly, usage.month_wait]]) {
    if (!Number.isSafeInteger(Number(used)) || Number(used) < 0 ||
      (limit != null && (!Number.isSafeInteger(limit) || limit < 1))) return { allowed: false, retryAfterSeconds: 900 };
    if (limit != null && Number(used) + costUnits > limit) wait = Math.max(wait, Math.ceil(Number(seconds)));
  }
  if (wait > 0) return { allowed: false, retryAfterSeconds: wait };
  const { rows: [reservation] } = await client.query(`INSERT INTO web_search_provider_usage
    (provider_key,purpose,operation,status,cost_units,searched_at,metadata)
    VALUES ($1,$2,$3,'skipped',$4,clock_timestamp(),'{"quotaReservation":true}'::jsonb) RETURNING id`,
  [provider, purpose, operation, costUnits]);
  await advanceWebSearchPacing(client, provider);
  return { allowed: true, id: reservation.id, costUnits };
}

/** Complete once; never refund uncertain spend or insert a second usage event. */
export async function completeWebSearchQuotaReservation(db, input, values) {
  if (!/^[1-9]\d*$/.test(String(input.reservationId))) throw new TypeError('invalid_quota_reservation_id');
  return db.query(`UPDATE web_search_provider_usage SET purpose=$2,operation=$3,status=$4,
    cost_units=GREATEST(cost_units,$5),result_count=$6,duration_ms=$7,correlation_id=$8,
    classification_id=$9,error_code=$10,http_status=$11,retryable=$12,cooldown_eligible=$13,
    retry_after_seconds=$14,metadata=$15::jsonb||'{"quotaReservation":true,"completed":true}'::jsonb
    WHERE id=$16 AND provider_key=$1 AND metadata @> '{"quotaReservation":true}'::jsonb
      AND NOT (metadata @> '{"completed":true}'::jsonb) RETURNING *`, [...values, input.reservationId]);
}
