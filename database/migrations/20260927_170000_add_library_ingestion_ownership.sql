-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE TABLE library_ingestion_state (
  library_id INTEGER PRIMARY KEY REFERENCES libraries(id) ON DELETE CASCADE,
  run_id UUID NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('running','retry_wait','complete')),
  sync_status_id INTEGER,
  capture_generation BIGINT,
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count BETWEEN 1 AND 1000000),
  restart_count INTEGER NOT NULL DEFAULT 0 CHECK (restart_count >= 0),
  pages_processed INTEGER NOT NULL DEFAULT 0 CHECK (pages_processed >= 0),
  items_processed INTEGER NOT NULL DEFAULT 0 CHECK (items_processed >= 0),
  items_total INTEGER CHECK (items_total >= 0),
  retry_after TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX idx_library_ingestion_due ON library_ingestion_state(retry_after,library_id)
  WHERE phase IN ('running','retry_wait');
CREATE INDEX idx_library_sync_latest ON media_server_sync_status(library_id,created_at DESC,id DESC);
COMMENT ON TABLE library_ingestion_state IS
  'Bounded latest ingestion owner/checkpoint. Ownership is a PostgreSQL session lock, not an age-based lease. Pages replay from zero after interruption.';
