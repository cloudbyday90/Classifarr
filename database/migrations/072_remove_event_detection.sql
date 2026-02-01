-- Migration 072: Remove Event Detection System
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration completely removes the deprecated event detection system
-- that was migrated to PolicyEngine presets in v0.37.0 (migration 046)
--
-- Related Issue: #228
-- Parent Epic: #168 (v0.41.0-alpha)
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ============================================================================
-- STEP 1: Remove event preset references from policies
-- ============================================================================
-- IMPORTANT: This must run BEFORE deleting content_presets (Step 2) because
-- it references content_presets.key to find the preset IDs to delete.
-- Clean up any policy_presets entries that reference event presets
DELETE FROM policy_presets
WHERE preset_id IN (
    SELECT id FROM content_presets
    WHERE key LIKE 'event_%'
);

-- ============================================================================
-- STEP 2: Remove event presets from content_presets table
-- ============================================================================
-- Delete all event detection presets (6 total):
-- event_holiday, event_sports, event_ppv, event_concert, event_standup, event_awards
DELETE FROM content_presets
WHERE key IN (
    'event_holiday',
    'event_sports',
    'event_ppv',
    'event_concert',
    'event_standup',
    'event_awards'
);

-- ============================================================================
-- STEP 3: Drop event detection columns from libraries table
-- ============================================================================
-- Remove event_detection_type column (added in migration 025)
ALTER TABLE libraries
DROP COLUMN IF EXISTS event_detection_type;

-- Remove event_sub_type column (added in migration 038)
ALTER TABLE libraries
DROP COLUMN IF EXISTS event_sub_type;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
DECLARE
    column_count INTEGER;
    preset_count INTEGER;
    policy_preset_count INTEGER;
BEGIN
    -- Verify columns are removed
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns
    WHERE table_name = 'libraries'
      AND column_name IN ('event_detection_type', 'event_sub_type');
    
    IF column_count > 0 THEN
        RAISE WARNING 'Event detection columns still exist in libraries table: %', column_count;
    ELSE
        RAISE NOTICE 'Event detection columns successfully removed from libraries table';
    END IF;
    
    -- Verify event presets are removed
    SELECT COUNT(*) INTO preset_count
    FROM content_presets
    WHERE key LIKE 'event_%';
    
    IF preset_count > 0 THEN
        RAISE WARNING 'Event presets still exist: %', preset_count;
    ELSE
        RAISE NOTICE 'All event presets successfully removed';
    END IF;
    
    -- Verify policy references are removed
    SELECT COUNT(*) INTO policy_preset_count
    FROM policy_presets pp
    INNER JOIN content_presets cp ON pp.preset_id = cp.id
    WHERE cp.key LIKE 'event_%';
    
    IF policy_preset_count > 0 THEN
        RAISE WARNING 'Policy references to event presets still exist: %', policy_preset_count;
    ELSE
        RAISE NOTICE 'All policy references to event presets successfully removed';
    END IF;
    
    RAISE NOTICE 'Migration 072: Event detection system removal complete';
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (Down Migration)
-- ============================================================================
-- To rollback this migration, restore the columns (data will be lost):
--
-- BEGIN;
-- 
-- -- Restore columns to libraries table
-- ALTER TABLE libraries ADD COLUMN IF NOT EXISTS event_detection_type VARCHAR(50) DEFAULT NULL;
-- ALTER TABLE libraries ADD COLUMN IF NOT EXISTS event_sub_type VARCHAR(50) DEFAULT NULL;
-- 
-- COMMENT ON COLUMN libraries.event_detection_type IS 'DEPRECATED: Event detection type (migrated to PolicyEngine)';
-- COMMENT ON COLUMN libraries.event_sub_type IS 'DEPRECATED: Event sub-type (migrated to PolicyEngine)';
-- 
-- -- Note: Event presets and policy references cannot be automatically restored
-- -- They must be recreated manually or by re-running migration 046
-- 
-- COMMIT;
