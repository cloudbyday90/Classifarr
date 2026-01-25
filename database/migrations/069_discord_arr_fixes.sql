-- Migration: 069_discord_arr_fixes.sql
-- Purpose: Consolidated fixes for Discord clarification and *arr routing (v0.40.4-alpha)

-- 1) Expand clarification_status length
ALTER TABLE classification_history
ALTER COLUMN clarification_status TYPE VARCHAR(32);

-- 2) Update method constraint to allow manual_classification
ALTER TABLE classification_history
DROP CONSTRAINT IF EXISTS classification_history_method_check;

ALTER TABLE classification_history
ADD CONSTRAINT classification_history_method_check
CHECK (method IN (
    -- CURRENT METHODS
    'existing_media',
    'manual_correction',
    'manual_classification',
    'exact_match',
    'learned_pattern',
    'source_library',
    'policy_auto',
    'policy_prompt',
    'ai_verified',
    'ai_analysis',
    'signal_calculation',
    'fallback',
    'queued_for_retry',

    -- LEGACY METHODS
    'custom_rule',
    'rule_match',
    'ai_fallback',
    'holiday_detection',
    'library_rule'
));

-- 3) Backfill libraries *arr fields from library_arr_mappings (one-time)
UPDATE libraries l
SET arr_type = COALESCE(l.arr_type, lam.arr_type),
    arr_id = COALESCE(l.arr_id, lam.arr_config_id),
    root_folder = COALESCE(l.root_folder, lam.arr_root_folder_path),
    quality_profile_id = COALESCE(l.quality_profile_id, lam.quality_profile_id),
    radarr_settings = CASE
      WHEN lam.arr_type = 'radarr' AND (l.radarr_settings IS NULL OR l.radarr_settings = '{}'::jsonb)
      THEN jsonb_build_object(
        'root_folder_path', lam.arr_root_folder_path,
        'quality_profile_id', lam.quality_profile_id,
        'monitor', true,
        'search_on_add', true
      )
      ELSE l.radarr_settings
    END,
    sonarr_settings = CASE
      WHEN lam.arr_type = 'sonarr' AND (l.sonarr_settings IS NULL OR l.sonarr_settings = '{}'::jsonb)
      THEN jsonb_build_object(
        'root_folder_path', lam.arr_root_folder_path,
        'quality_profile_id', lam.quality_profile_id,
        'monitor', true,
        'search_on_add', true,
        'series_type', 'standard',
        'season_monitoring', 'all',
        'season_folder', true
      )
      ELSE l.sonarr_settings
    END,
    updated_at = NOW()
FROM library_arr_mappings lam
WHERE lam.library_id = l.id
  AND (l.arr_id IS NULL OR l.arr_id = 0);

-- 4) Cleanup invalid policy_question strings (e.g., "[object Object]")
UPDATE classification_history
SET policy_question = NULL
WHERE policy_question IS NOT NULL
  AND jsonb_typeof(policy_question) = 'string'
  AND trim(both '"' from policy_question::text) !~ '^[\\[{]';
