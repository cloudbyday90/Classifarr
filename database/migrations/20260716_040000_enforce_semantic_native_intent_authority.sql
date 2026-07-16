/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

-- An active policy_intents row is authoritative only when it represents a
-- fully materialized native policy: native source, complete inference, safe
-- validation, and at least one persisted purpose rule. Earlier reconciliation
-- builds could create an active empty header. Repair only the two provable
-- cases below; refuse all other active shapes instead of inventing intent.

LOCK TABLE policy_intents, policy_intent_rules IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE policy_intent_migration_events
    DROP CONSTRAINT IF EXISTS policy_intent_migration_events_event_type_chk;

ALTER TABLE policy_intent_migration_events
    ADD CONSTRAINT policy_intent_migration_events_event_type_chk CHECK (
        event_type IN (
            'dry_run_reported',
            'conversion_started',
            'conversion_applied',
            'conversion_failed',
            'rollback_snapshot_created',
            'rollback_applied',
            'rollback_snapshot_payload_redacted',
            'native_validated',
            'legacy_deletion_ready',
            'library_rebuild_replacement_applied',
            'active_intent_integrity_repaired',
            'reconciliation_reentry_approved',
            'semantic_intent_authority_repaired'
        )
    );

WITH normalized_headers AS (
    UPDATE policy_intents AS intent
    SET
        source = 'native_intent',
        updated_at = NOW()
    WHERE intent.active = TRUE
      AND intent.source = 'legacy_presets'
      AND intent.inference_state = 'inferred'
      AND intent.validation_status IN ('valid', 'warning')
      AND EXISTS (
          SELECT 1
          FROM policy_intent_rules purpose_rule
          WHERE purpose_rule.intent_id = intent.id
            AND purpose_rule.intent_role = 'purpose'
      )
    RETURNING intent.id, intent.policy_id, intent.intent_version
)
INSERT INTO policy_intent_migration_events (
    intent_id,
    policy_id,
    event_type,
    actor_type,
    actor_id,
    source_version,
    target_version,
    reason_code,
    summary,
    metadata
)
SELECT
    normalized_headers.id,
    normalized_headers.policy_id,
    'semantic_intent_authority_repaired',
    'maintainer',
    NULL,
    NULL,
    normalized_headers.intent_version,
    'legacy_header_normalized',
    'Normalized a fully materialized legacy-origin intent header to native authority.',
    jsonb_build_object('repair_action', 'legacy_header_normalized')
FROM normalized_headers;

WITH deactivated_empty_headers AS (
    UPDATE policy_intents AS intent
    SET
        active = FALSE,
        updated_at = NOW()
    WHERE intent.active = TRUE
      AND intent.source = 'empty'
      AND intent.inference_state = 'empty'
      AND NOT EXISTS (
          SELECT 1
          FROM policy_intent_rules rule
          WHERE rule.intent_id = intent.id
      )
    RETURNING intent.id, intent.policy_id, intent.intent_version
)
INSERT INTO policy_intent_migration_events (
    intent_id,
    policy_id,
    event_type,
    actor_type,
    actor_id,
    source_version,
    target_version,
    reason_code,
    summary,
    metadata
)
SELECT
    deactivated_empty_headers.id,
    deactivated_empty_headers.policy_id,
    'semantic_intent_authority_repaired',
    'maintainer',
    NULL,
    NULL,
    deactivated_empty_headers.intent_version,
    'empty_header_deactivated',
    'Deactivated an empty active intent header so compatibility behavior remains authoritative.',
    jsonb_build_object('repair_action', 'empty_header_deactivated')
FROM deactivated_empty_headers;

DO $$
DECLARE
    unresolved_policy_ids INTEGER[];
BEGIN
    SELECT ARRAY_AGG(policy_id ORDER BY policy_id)
    INTO unresolved_policy_ids
    FROM (
        SELECT intent.policy_id
        FROM policy_intents AS intent
        WHERE intent.active = TRUE
          AND (
              intent.source <> 'native_intent'
              OR intent.inference_state <> 'inferred'
              OR intent.validation_status NOT IN ('valid', 'warning')
              OR NOT EXISTS (
                  SELECT 1
                  FROM policy_intent_rules purpose_rule
                  WHERE purpose_rule.intent_id = intent.id
                    AND purpose_rule.intent_role = 'purpose'
              )
          )
        ORDER BY intent.policy_id
    ) unresolved_intents;

    IF unresolved_policy_ids IS NOT NULL THEN
        RAISE EXCEPTION
            'Cannot enforce semantic native intent authority; unresolved active intent policies: %',
            unresolved_policy_ids
            USING ERRCODE = '23514',
                  HINT = 'Repair or deactivate the listed active intent rows before rerunning the migration.';
    END IF;
END $$;

ALTER TABLE policy_intents
    ADD CONSTRAINT policy_intents_active_native_authority_header_chk CHECK (
        active = FALSE
        OR (
            source = 'native_intent'
            AND inference_state = 'inferred'
            AND validation_status IN ('valid', 'warning')
        )
    );

CREATE OR REPLACE FUNCTION enforce_policy_intent_active_purpose_rule()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    affected_intent_id BIGINT;
BEGIN
    IF TG_TABLE_NAME = 'policy_intents' THEN
        affected_intent_id := COALESCE(NEW.id, OLD.id);
    ELSE
        affected_intent_id := COALESCE(NEW.intent_id, OLD.intent_id);
    END IF;

    IF EXISTS (
        SELECT 1
        FROM policy_intents AS intent
        WHERE intent.id = affected_intent_id
          AND intent.active = TRUE
    ) AND NOT EXISTS (
        SELECT 1
        FROM policy_intent_rules AS purpose_rule
        WHERE purpose_rule.intent_id = affected_intent_id
          AND purpose_rule.intent_role = 'purpose'
    ) THEN
        RAISE EXCEPTION
            'Active native intent % requires at least one purpose rule',
            affected_intent_id
            USING ERRCODE = '23514',
                  HINT = 'Insert a purpose rule in the same transaction or deactivate the intent.';
    END IF;

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER policy_intents_active_purpose_rule_chk
    AFTER INSERT OR UPDATE OF active, source, inference_state, validation_status
    ON policy_intents
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION enforce_policy_intent_active_purpose_rule();

CREATE CONSTRAINT TRIGGER policy_intent_rules_active_purpose_rule_chk
    AFTER INSERT OR UPDATE OR DELETE
    ON policy_intent_rules
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION enforce_policy_intent_active_purpose_rule();
