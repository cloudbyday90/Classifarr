/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { normalizeDatabaseBigintId } from './databaseIntegerValues.mjs';

export async function hasPolicyLibraryRebuildReplacementIntentProof({ client, execution }) {
  const eventId = normalizeDatabaseBigintId(execution.replacement_event_id);
  const intentId = normalizeDatabaseBigintId(execution.replacement_intent_id);
  const originalIntentId = normalizeDatabaseBigintId(execution.intent_id);
  if (eventId === null || intentId === null || originalIntentId === null) return false;
  if (typeof intentId === 'number' && typeof originalIntentId === 'number') return true;

  // The original intent's successor pointer can be cleared by reversion.
  const result = await client.query(
    `SELECT event.id
     FROM policy_intent_migration_events event
     JOIN policy_intents intent ON intent.id = event.intent_id
       AND intent.policy_id = event.policy_id
     WHERE event.id = $1
       AND event.policy_id = $2
       AND event.intent_id = $3
       AND intent.library_id = $4
       AND event.event_type = 'library_rebuild_replacement_applied'
       AND event.metadata -> 'executionGateId' = $5::jsonb
       AND event.metadata ->> 'transitionFingerprint' = $6
       AND event.metadata -> 'replacementIntentId' = $7::jsonb
       AND ($8::boolean OR event.metadata -> 'originalIntentId' = $9::jsonb)
     FOR SHARE OF event, intent`,
    [
      eventId,
      execution.policy_id,
      intentId,
      execution.library_id,
      JSON.stringify(normalizeDatabaseBigintId(execution.id)),
      execution.transition_fingerprint,
      JSON.stringify(intentId),
      typeof originalIntentId === 'number',
      JSON.stringify(originalIntentId),
    ],
  );
  return normalizeDatabaseBigintId(result.rows[0]?.id) === eventId;
}
