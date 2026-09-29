/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evaluateOmdbQuota } from './omdbQuotaStore.mjs';
import { reserveWebSearchQuota } from './webSearchQuotaReservation.mjs';

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
  return (await reserveWebSearchQuota(client, { provider: candidate.provider_key, config,
    context: { source: candidate.source, id: config.id, generation: config.credential_generation },
    costUnits: 1, purpose: 'credential_recovery', operation: 'recovery_probe' })).allowed;
}
