/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const INITIAL_ESTABLISHMENT_ROLLBACK_PATH_PREFIX = 'policy/initial-intent-establishment/rollback/';

// Shared joins for queries with a receipt aliased as establishment.
export const INITIAL_ESTABLISHMENT_RECEIPT_PROOF_JOINS_SQL = `
       JOIN policy_intents established_intent
         ON established_intent.id = establishment.intent_id
        AND established_intent.policy_id = establishment.policy_id
        AND established_intent.library_id = establishment.library_id
        AND established_intent.intent_version = 1
        AND established_intent.source = 'native_intent'
       JOIN policy_intent_migration_events establishment_event
         ON establishment_event.id = establishment.migration_event_id
        AND establishment_event.intent_id = established_intent.id
        AND establishment_event.policy_id = establishment.policy_id
        AND establishment_event.event_type = 'initial_intent_established'
        AND establishment_event.actor_type = 'operator'
        AND establishment_event.actor_id = establishment.accepted_by
        AND establishment_event.reason_code = 'operator_declared_initial_intent'
        AND establishment_event.source_version IS NULL
        AND establishment_event.target_version = established_intent.intent_version
        AND establishment_event.metadata -> 'authority_source_id' = to_jsonb(establishment.authority_source_id::text)
        AND establishment_event.metadata -> 'request_fingerprint' = to_jsonb(establishment.request_fingerprint::text)`;
