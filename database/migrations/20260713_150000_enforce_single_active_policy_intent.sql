/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

-- Native intent has one active authority per policy. The prior partial index
-- included intent_version, so two active versions could coexist. Lock writers,
-- retain every row, and only repair a group when a validated candidate exists.
LOCK TABLE policy_intents IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
    unsafe_policy_ids INTEGER[];
BEGIN
    SELECT ARRAY_AGG(policy_id ORDER BY policy_id)
    INTO unsafe_policy_ids
    FROM (
        SELECT policy_id
        FROM policy_intents
        WHERE active = TRUE
        GROUP BY policy_id
        HAVING COUNT(*) > 1
           AND COUNT(*) FILTER (
               WHERE validation_status IN ('valid', 'warning')
           ) = 0
    ) unsafe_policies;

    IF unsafe_policy_ids IS NOT NULL THEN
        RAISE EXCEPTION
            'Cannot enforce one active native intent: policies without a validated repair candidate: %',
            unsafe_policy_ids
            USING ERRCODE = '23514',
                  HINT = 'Resolve or validate the active native intents, then rerun the migration.';
    END IF;
END $$;

ALTER TABLE policy_intent_migration_events
    DROP CONSTRAINT policy_intent_migration_events_event_type_chk;

ALTER TABLE policy_intent_migration_events
    ADD CONSTRAINT policy_intent_migration_events_event_type_chk CHECK (
        event_type IN (
            'dry_run_reported',
            'conversion_started',
            'conversion_applied',
            'conversion_failed',
            'rollback_snapshot_created',
            'rollback_applied',
            'native_validated',
            'legacy_deletion_ready',
            'library_rebuild_replacement_applied',
            'active_intent_integrity_repaired'
        )
    );

WITH ranked_active_intents AS (
    SELECT
        id,
        policy_id,
        intent_version,
        ROW_NUMBER() OVER (
            PARTITION BY policy_id
            ORDER BY
                CASE validation_status
                    WHEN 'valid' THEN 0
                    WHEN 'warning' THEN 1
                    ELSE 2
                END,
                intent_version DESC,
                accepted_at DESC NULLS LAST,
                updated_at DESC,
                created_at DESC,
                id DESC
        ) AS authority_rank,
        COUNT(*) OVER (PARTITION BY policy_id) AS active_intent_count
    FROM policy_intents
    WHERE active = TRUE
), repair_summary AS (
    SELECT
        policy_id,
        MAX(id) FILTER (WHERE authority_rank = 1) AS canonical_intent_id,
        MAX(intent_version) FILTER (WHERE authority_rank = 1) AS canonical_intent_version,
        ARRAY_AGG(id ORDER BY id) FILTER (WHERE authority_rank > 1) AS deactivated_intent_ids
    FROM ranked_active_intents
    WHERE active_intent_count > 1
    GROUP BY policy_id
), repaired_intents AS (
    UPDATE policy_intents AS intent
    SET
        active = FALSE,
        replaced_by_intent_id = repair_summary.canonical_intent_id,
        updated_at = NOW()
    FROM repair_summary
    WHERE intent.id = ANY(repair_summary.deactivated_intent_ids)
    RETURNING intent.id
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
    repair_summary.canonical_intent_id,
    repair_summary.policy_id,
    'active_intent_integrity_repaired',
    'maintainer',
    NULL,
    NULL,
    repair_summary.canonical_intent_version,
    'single_active_intent_enforced',
    'Deactivated duplicate active native intents while preserving their history.',
    jsonb_build_object(
        'canonical_intent_id', repair_summary.canonical_intent_id,
        'canonical_intent_version', repair_summary.canonical_intent_version,
        'deactivated_intent_ids', repair_summary.deactivated_intent_ids,
        'deactivated_count', CARDINALITY(repair_summary.deactivated_intent_ids)
    )
FROM repair_summary
WHERE EXISTS (SELECT 1 FROM repaired_intents);

CREATE UNIQUE INDEX idx_policy_intents_one_active_policy
    ON policy_intents (policy_id)
    WHERE active = TRUE;

DROP INDEX idx_policy_intents_active_version;
