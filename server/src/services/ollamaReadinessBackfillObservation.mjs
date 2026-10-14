/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolveOllamaVerificationCapabilityIdentity } from './ollamaVerificationCapabilityIdentity.mjs';
import { normalizeReadinessObservation, projectReadinessBackfill } from './ollamaReadinessBackfillStatus.mjs';

/** Small, bounded diagnostic write. Never spans provider I/O or authorizes work. */
export async function recordReadinessBackfill(database, configuration, result) {
  const identity = resolveOllamaVerificationCapabilityIdentity(configuration ?? {});
  if (!identity.applicable || ['already_checked', 'not_applicable'].includes(result?.reason)) return;
  const observation = normalizeReadinessObservation(result);
  await database.withTransaction(async tx => {
    await tx.query("SET LOCAL statement_timeout='3s'; SET LOCAL lock_timeout='1s'; SET LOCAL transaction_timeout='5s'");
    const { rows: [current] } = await tx.query(`SELECT primary_provider,ollama_host,ollama_port,ollama_model,
      configuration_revision,ollama_verification_capability_checked_at FROM ai_provider_config WHERE id=1 FOR SHARE`);
    const currentIdentity = resolveOllamaVerificationCapabilityIdentity(current ?? {});
    if (!currentIdentity.applicable || currentIdentity.configurationRevision !== identity.configurationRevision ||
      currentIdentity.fingerprint !== identity.fingerprint ||
      (current.ollama_verification_capability_checked_at != null && observation.status !== 'completed')) return;
    await tx.query(`INSERT INTO ollama_readiness_backfill_state
      (id,configuration_revision,configuration_fingerprint,status,reason) VALUES (1,$1,$2,$3,$4)
      ON CONFLICT (id) DO UPDATE SET configuration_revision=EXCLUDED.configuration_revision,
        configuration_fingerprint=EXCLUDED.configuration_fingerprint,status=EXCLUDED.status,
        reason=EXCLUDED.reason,observed_at=clock_timestamp()
      WHERE (ollama_readiness_backfill_state.configuration_revision IS DISTINCT FROM EXCLUDED.configuration_revision
        OR ollama_readiness_backfill_state.configuration_fingerprint IS DISTINCT FROM EXCLUDED.configuration_fingerprint
        OR ollama_readiness_backfill_state.status IS DISTINCT FROM EXCLUDED.status
        OR ollama_readiness_backfill_state.reason IS DISTINCT FROM EXCLUDED.reason
        OR ollama_readiness_backfill_state.observed_at < clock_timestamp()-interval '5 minutes')
      AND NOT (EXCLUDED.reason='busy' AND ollama_readiness_backfill_state.status='checking'
        AND ollama_readiness_backfill_state.observed_at > clock_timestamp()-interval '2 minutes'
        AND ollama_readiness_backfill_state.configuration_revision=EXCLUDED.configuration_revision
        AND ollama_readiness_backfill_state.configuration_fingerprint=EXCLUDED.configuration_fingerprint)`,
    [identity.configurationRevision, identity.fingerprint, observation.status, observation.reason]);
  });
}

export async function readReadinessBackfill(database, configuration) {
  if (configuration?.primary_provider !== 'ollama' || configuration.ollama_verification_capability_checked_at != null) return null;
  try {
    const { rows: [row] } = await database.query(`SELECT configuration_revision,configuration_fingerprint,
      status,reason,observed_at FROM ollama_readiness_backfill_state WHERE id=1`);
    return projectReadinessBackfill(configuration, row);
  } catch {
    // Diagnostics must not turn a known capability verdict into an API failure.
    return projectReadinessBackfill(configuration, null);
  }
}
