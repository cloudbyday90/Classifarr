-- One pending, expiring confirmation per human administrator.
CREATE TABLE IF NOT EXISTS media_identity_review_previews (
    actor_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    id UUID NOT NULL UNIQUE,
    item_id INTEGER NOT NULL REFERENCES media_server_items(id) ON DELETE CASCADE,
    source_version VARCHAR(64) NOT NULL CHECK (source_version ~ '^[a-f0-9]{64}$'),
    candidate JSONB NOT NULL CHECK (jsonb_typeof(candidate) = 'object'),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_server_items_identity_review
    ON media_server_items (id)
    WHERE tmdb_id IS NULL AND media_type IN ('movie', 'tv')
      AND metadata @> '{"tmdb_resolution":{"version":1,"status":"review_required"}}'::jsonb;
