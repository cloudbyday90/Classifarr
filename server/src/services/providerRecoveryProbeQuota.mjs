/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evaluateOmdbQuota } from './omdbQuotaStore.mjs';
import { reserveWebSearchQuota } from './webSearchQuotaReservation.mjs';
import { advanceOmdbPacing, omdbPacingWait } from './omdbPacingStore.mjs';
import { providerCredentialContext } from './providerCredentialRejection.mjs';

/** Called with the selected configuration locked, before sending HTTP. */
export async function reserveProviderProbeQuota(client, candidate, config, now) {
  if (candidate.source === 'omdb') {
    const quota = evaluateOmdbQuota({ ...config, credential_rejected_at: null });
    if (quota.status !== 'available') return { allowed: false };
    const wait = await omdbPacingWait(client, providerCredentialContext('omdb', config));
    if (wait > 0) return { allowed: false, waitSeconds: wait };
    await advanceOmdbPacing(client);
    await client.query('UPDATE omdb_config SET requests_today=$2,last_reset_date=$3::date WHERE id=$1',
      [config.id, quota.used + 1, quota.day]);
    return { allowed: true };
  }
  if (config.cooldown_until && new Date(config.cooldown_until).getTime() > now) return { allowed: false };
  return reserveWebSearchQuota(client, { provider: candidate.provider_key, config,
    context: { source: candidate.source, id: config.id, generation: config.credential_generation },
    costUnits: 1, purpose: 'credential_recovery', operation: 'recovery_probe' });
}
