/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { POLICY_NATIVE_INTENT_CHANGE_RECEIPT_BINDING_DOMAIN } from './policyNativeIntentChangeReceiptContract.mjs';

const maximumSafeId = Number.MAX_SAFE_INTEGER;

// Two fixed callers supply either bound parameters or columns of change_receipt.
function bindingPredicateSql({ eventId, intentId, policyId, actorId, sourceVersion, targetVersion, digest }) {
  return `event.id = ${eventId}
       AND intent.id = ${intentId}
       AND event.policy_id = ${policyId}
       AND intent.policy_id = ${policyId}
       AND event.event_type = 'native_intent_change_applied'
       AND event.actor_type = 'operator'
       AND event.actor_id = ${actorId}
       AND event.source_version = ${sourceVersion}
       AND event.target_version = ${targetVersion}
       AND intent.intent_version = ${targetVersion}
       AND event.metadata -> 'receiptBindingDigest' = to_jsonb(${digest})`;
}

export const NATIVE_INTENT_CHANGE_REPLAY_BINDING_SQL = bindingPredicateSql({
  eventId: '$1',
  intentId: '$2',
  policyId: '$3',
  actorId: '$4',
  sourceVersion: '$5',
  targetVersion: '$6',
  digest: '$7::text',
});

// Match the receipt producer's compact key order and JSON type before hashing.
const changeReceiptDigestSql = `encode(sha256(convert_to(
         '{"commandFingerprint":' || to_json(change_receipt.command_fingerprint::text)::text ||
         ',"domain":"${POLICY_NATIVE_INTENT_CHANGE_RECEIPT_BINDING_DOMAIN}","idempotencyKey":' ||
         to_json(change_receipt.idempotency_key::text)::text || ',"targetIntentId":' ||
         CASE WHEN change_receipt.target_intent_id <= ${maximumSafeId}
           THEN change_receipt.target_intent_id::text
           ELSE to_json(change_receipt.target_intent_id::text)::text
         END || '}',
         'UTF8')), 'hex')`;

const changeReceiptBindingSql = bindingPredicateSql({
  eventId: 'change_receipt.migration_event_id',
  intentId: 'change_receipt.target_intent_id',
  policyId: 'change_receipt.policy_id',
  actorId: 'change_receipt.actor_id',
  sourceVersion: 'change_receipt.source_intent_version',
  targetVersion: 'change_receipt.target_intent_version',
  digest: changeReceiptDigestSql,
});

export const NATIVE_INTENT_CHANGE_LIFECYCLE_PROOF_SQL = `(
       change_receipt.target_intent_id > 0 AND change_receipt.migration_event_id > 0
       AND CASE WHEN change_receipt.target_intent_id <= ${maximumSafeId}
                  AND change_receipt.migration_event_id <= ${maximumSafeId}
         THEN TRUE
         ELSE EXISTS (
           SELECT 1
           FROM policy_intent_migration_events event
           JOIN policy_intents intent ON intent.id = event.intent_id
           WHERE ${changeReceiptBindingSql}
         )
       END
     )`;
