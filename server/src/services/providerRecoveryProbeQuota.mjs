/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evaluateOmdbQuota } from './omdbQuotaStore.mjs';

/** Called with the selected configuration locked, before sending HTTP. */
export async function reserveProviderProbeQuota(client, candidate, config, now) {
  if (candidate.source === 'omdb') {
    const quota = evaluateOmdbQuota({ ...config, credential_rejected_at: null });
    if (quota.status !== 'available') return false;
    await client.query('UPDATE omdb_config SET requests_today=$2,last_reset_date=$3::date WHERE id=$1',
      [config.id, quota.used + 1, quota.day]);
    return true;
  }
  if (config.cooldown_until && new Date(config.cooldown_until).getTime() > now) return false;
  const { rows: [usage] } = await client.query(`SELECT
    COALESCE(sum(cost_units) FILTER (WHERE searched_at >= date_trunc('day',statement_timestamp())),0)::bigint AS daily,
    COALESCE(sum(cost_units),0)::bigint AS monthly FROM web_search_provider_usage
    WHERE provider_key=$1 AND searched_at>=date_trunc('month',statement_timestamp())`, [candidate.provider_key]);
  for (const [limit, used] of [[config.soft_daily_limit, usage.daily], [config.soft_monthly_limit, usage.monthly]]) {
    if (limit != null && (!Number.isSafeInteger(limit) || limit < 1 || Number(used) + 1 > limit)) return false;
  }
  // Append-only conservative reservation: includes failed/crashed/uncertain attempts.
  // Ordinary web routing still uses soft limits; this does not claim a hard global cap.
  await client.query(`INSERT INTO web_search_provider_usage
    (provider_key,purpose,operation,status,cost_units,metadata)
    VALUES ($1,'credential_recovery','recovery_probe','skipped',1,'{"reserved":true}'::jsonb)`, [candidate.provider_key]);
  return true;
}
