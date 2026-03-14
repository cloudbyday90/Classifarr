/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

-- Migration: auto-drop legacy-incompatible preset attachments
--
-- Product decision:
--   Existing preset attachments that now fall into the legacy
--   "advisory_defaulted + review_recommended" bucket should be removed
--   automatically during upgrade so operators can reapply corrected presets
--   under the new advisory-by-default runtime model.
--
-- This migration intentionally removes only the narrow incompatible bucket:
--   - merged language constraints still exist (from base preset or custom override)
--   - base preset does NOT declare strict runtime behavior
--   - attached preset does NOT explicitly opt into strict runtime behavior
--
-- In JS terms this mirrors:
--   runtime_semantics.migration_state === 'advisory_defaulted'
--   && runtime_semantics.review_recommended === true

WITH incompatible AS (
    SELECT DISTINCT
        pp.policy_id,
        pp.preset_id,
        lp.name AS policy_name,
        l.id AS library_id,
        l.name AS library_name,
        cp.key AS preset_key,
        cp.name AS preset_name
    FROM policy_presets pp
    JOIN library_policies lp ON lp.id = pp.policy_id
    JOIN libraries l ON l.id = lp.library_id
    JOIN content_presets cp ON cp.id = pp.preset_id
    WHERE
        (
            CASE
                WHEN jsonb_typeof(COALESCE(cp.signals, '{}'::jsonb)->'language'->'require_any') = 'array'
                    THEN jsonb_array_length(COALESCE(cp.signals, '{}'::jsonb)->'language'->'require_any')
                ELSE 0
            END > 0
            OR
            CASE
                WHEN jsonb_typeof(COALESCE(cp.signals, '{}'::jsonb)->'language'->'exclude') = 'array'
                    THEN jsonb_array_length(COALESCE(cp.signals, '{}'::jsonb)->'language'->'exclude')
                ELSE 0
            END > 0
            OR
            CASE
                WHEN jsonb_typeof(COALESCE(pp.custom_signals, '{}'::jsonb)->'language'->'require_any') = 'array'
                    THEN jsonb_array_length(COALESCE(pp.custom_signals, '{}'::jsonb)->'language'->'require_any')
                ELSE 0
            END > 0
            OR
            CASE
                WHEN jsonb_typeof(COALESCE(pp.custom_signals, '{}'::jsonb)->'language'->'exclude') = 'array'
                    THEN jsonb_array_length(COALESCE(pp.custom_signals, '{}'::jsonb)->'language'->'exclude')
                ELSE 0
            END > 0
        )
        AND COALESCE(COALESCE(cp.signals, '{}'::jsonb)->'language'->>'strict', 'false') <> 'true'
        AND NOT (COALESCE(COALESCE(pp.custom_signals, '{}'::jsonb)->'language', '{}'::jsonb) ? 'strict')
),
deleted AS (
    DELETE FROM policy_presets pp
    USING incompatible i
    WHERE pp.policy_id = i.policy_id
      AND pp.preset_id = i.preset_id
    RETURNING pp.policy_id, pp.preset_id
),
deleted_details AS (
    SELECT
        i.policy_id,
        i.preset_id,
        i.policy_name,
        i.library_id,
        i.library_name,
        i.preset_key,
        i.preset_name
    FROM incompatible i
    JOIN deleted d
      ON d.policy_id = i.policy_id
     AND d.preset_id = i.preset_id
),
summary AS (
    SELECT
        COUNT(*)::int AS dropped_count,
        jsonb_build_object(
            'migration', '20260313_233000_auto_drop_legacy_incompatible_policy_presets.sql',
            'mode', 'automatic_targeted_drop',
            'executed_at', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'dropped_count', COUNT(*),
            'affected_policy_count', COUNT(DISTINCT policy_id),
            'affected_library_count', COUNT(DISTINCT library_id),
            'preset_keys', COALESCE((
                SELECT jsonb_agg(to_jsonb(keys.preset_key) ORDER BY keys.preset_key)
                FROM (
                    SELECT DISTINCT preset_key
                    FROM deleted_details
                    WHERE preset_key IS NOT NULL
                ) keys
            ), '[]'::jsonb),
            'dropped_attachments', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'policy_id', details.policy_id,
                        'policy_name', details.policy_name,
                        'library_id', details.library_id,
                        'library_name', details.library_name,
                        'preset_id', details.preset_id,
                        'preset_key', details.preset_key,
                        'preset_name', details.preset_name
                    )
                    ORDER BY details.library_name, details.policy_name, details.preset_name
                )
                FROM deleted_details details
            ), '[]'::jsonb)
        )::text AS value
    FROM deleted_details
)
INSERT INTO settings (key, value)
SELECT 'preset_semantics_v2_auto_drop_report', value
FROM summary
WHERE dropped_count > 0
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW();
