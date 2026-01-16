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

-- Backfill library associations from media_server_items
UPDATE classification_history ch
SET 
  library_name = l.name,
  library_id = msi.library_id,
  method = COALESCE(ch.method, 'source_library'),
  reason = COALESCE(ch.reason, 'Backfilled: Item exists in ' || l.name),
  updated_at = NOW()
FROM media_server_items msi
JOIN libraries l ON msi.library_id = l.id
WHERE ch.tmdb_id = msi.tmdb_id
  AND ch.media_type = msi.media_type
  AND ch.status = 'completed'
  AND ch.library_name IS NULL
  AND msi.tmdb_id IS NOT NULL;

-- Add index to improve RAG queries that join classification_history with embeddings
CREATE INDEX IF NOT EXISTS idx_classification_history_library_name 
ON classification_history(library_name) 
WHERE library_name IS NOT NULL;
