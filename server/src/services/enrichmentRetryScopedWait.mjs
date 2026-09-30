/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { providerRequestEvidence } from './providerRequestEvidence.mjs';
import { probeDefinition } from './providerRecoveryProbeQueries.mjs';
import { recordOmdbPacingDelay } from './omdbPacingStore.mjs';
import { lockWebSearchProvider, recordWebSearchPacingDelay } from './webSearchPacingStore.mjs';

/** Fenced result transaction only; no HTTP. Existing admission stores enforce each provider independently. */
export async function persistScopedRetryWait(client, queueId, type, schedule, result) {
  const contexts = providerRequestEvidence(result);
  if (!contexts || schedule.reset || !(schedule.cooldown || schedule.reason === 'provider_admission_wait') ||
    contexts.some(context => (context.source === 'omdb') !== (type === 'omdb'))) return false;
  await client.query(`UPDATE enrichment_retry_queue SET retry_wait_context=$2::jsonb,
    retry_wait_until=next_attempt_at WHERE id=$1`, [queueId, JSON.stringify(contexts)]);
  // Admission waits already have an authoritative provider deadline; do not extend it every time an item waits.
  if (!schedule.cooldown) return true;
  // Stable order prevents two multi-provider results from locking configurations in opposite orders.
  const ordered = [...contexts].sort((a, b) => a.source.localeCompare(b.source) || a.id - b.id);
  for (const context of ordered) {
    const definition = probeDefinition(context.source);
    if (definition.lock) await client.query(definition.lock);
    const { rows: [config] } = await client.query(definition.select.replace('FOR UPDATE SKIP LOCKED', 'FOR UPDATE'), [context.id]);
    if (!config || config.credential_generation !== context.generation ||
      (context.source === 'web_search' && config.provider_key !== context.providerKey)) continue;
    const seconds = Math.max(1, Math.ceil(schedule.delayMs / 1000));
    if (context.source === 'omdb') await recordOmdbPacingDelay(client, context, seconds);
    else {
      await lockWebSearchProvider(client, context.providerKey);
      await recordWebSearchPacingDelay(client, context.providerKey, context, seconds);
    }
  }
  return true;
}
