-- Migration: Backfill library associations for RAG training data
-- Bug: RAG has no usable training data - all classification_history records have library_name = NULL
--
-- Problem:
-- - 6,509 embeddings exist but ALL have library_name = NULL
-- - classification_history records created during Plex sync don't have library associations
-- - RAG semantic search, pattern learning, and history learning are non-functional
-- - Only library profiles work (uses media_server_items directly)
--
-- Solution:
-- - Backfill library_id and library_name from media_server_items where items match by tmdb_id and media_type
-- - Preserve existing library associations (only update NULL values)
-- - Set method and reason for tracking

-- Add 'backfill' as a valid classification method
ALTER TABLE classification_history
DROP CONSTRAINT IF EXISTS classification_history_method_check;

ALTER TABLE classification_history 
ADD CONSTRAINT classification_history_method_check 
CHECK (method IN (
    -- CURRENT METHODS (v0.37.8c+)
    'existing_media',       -- Media already in library
    'manual_correction',    -- User correction from learned_corrections
    'exact_match',          -- Previously confirmed TMDB ID
    'learned_pattern',      -- Pattern-based matching (still active)
    'source_library',       -- Came from known media server library
    'policy_auto',          -- PolicyEngine auto-classification (>=85%)
    'policy_prompt',        -- PolicyEngine prompts for confirmation (60-84%)
    'ai_verified',          -- AI validation path
    'ai_analysis',          -- AI analysis for low-confidence
    'signal_calculation',   -- Fallback when AI unavailable
    'fallback',             -- Last resort fallback
    'backfill',             -- Library associations backfilled from media_server_items

-- LEGACY METHODS (kept for historical data, no longer set)
'custom_rule',          -- Deprecated: replaced by PolicyEngine
    'rule_match',           -- Deprecated: replaced by PolicyEngine
    'ai_fallback',          -- Deprecated: replaced by ai_analysis
    'holiday_detection',    -- Deprecated: replaced by seasonal presets
    'library_rule'          -- Deprecated: replaced by PolicyEngine
));

-- Backfill library associations from media_server_items
UPDATE classification_history ch
SET
    library_name = l.name,
    library_id = msi.library_id,
    method = COALESCE(ch.method, 'backfill'),
    reason = COALESCE(
        ch.reason,
        'Backfilled: Item exists in ' || l.name
    )
FROM (
        -- Ensure only one media_server_items match per (tmdb_id, media_type)
        SELECT DISTINCT
            ON (tmdb_id, media_type) tmdb_id, media_type, library_id
        FROM media_server_items
        WHERE
            tmdb_id IS NOT NULL
        ORDER BY tmdb_id, media_type, library_id
    ) msi
    JOIN libraries l ON msi.library_id = l.id
WHERE
    ch.tmdb_id = msi.tmdb_id
    AND ch.media_type = msi.media_type
    AND ch.status = 'completed'
    AND ch.library_name IS NULL;

-- Add index to improve RAG queries that join classification_history with embeddings
CREATE INDEX IF NOT EXISTS idx_classification_history_library_name ON classification_history (library_name)
WHERE
    library_name IS NOT NULL;