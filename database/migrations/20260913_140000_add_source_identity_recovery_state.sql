-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
ALTER TABLE media_source_observations ADD COLUMN IF NOT EXISTS source_digest text
    CHECK (source_digest IS NULL OR source_digest ~ '^[a-f0-9]{64}$');
ALTER TABLE media_source_observations ADD COLUMN IF NOT EXISTS recovery_retry_after timestamptz;

CREATE TABLE IF NOT EXISTS media_sync_warning_state (
    library_id integer NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    media_server_id integer NOT NULL REFERENCES media_server(id) ON DELETE CASCADE,
    sync_type text NOT NULL CHECK (sync_type IN ('full', 'incremental')),
    last_sync_id integer NOT NULL CHECK (last_sync_id > 0),
    summary jsonb CHECK (summary IS NULL OR jsonb_typeof(summary) = 'object'),
    last_warned_at timestamptz,
    last_warning_sync_id integer,
    PRIMARY KEY (library_id, sync_type)
);
