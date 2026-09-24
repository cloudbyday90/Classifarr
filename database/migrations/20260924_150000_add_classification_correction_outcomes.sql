-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Deliberately no history/correction FK: retries must not erase explicit outcomes.
-- No legacy status backfill: a corrected status is not an operator event.
CREATE TABLE IF NOT EXISTS classification_correction_outcomes (
    correction_id integer PRIMARY KEY CHECK (correction_id > 0),
    media_type text NOT NULL CHECK (media_type IN ('movie', 'tv')),
    identity_key text NOT NULL CHECK (
        identity_key ~ '^source:[a-f0-9]{64}$'
        OR CASE WHEN identity_key ~ ('^' || media_type || ':[1-9][0-9]{0,9}$')
            THEN split_part(identity_key, ':', 2)::bigint <= 2147483647 ELSE false END
    ),
    selected_library_id integer NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    observed_at timestamptz NOT NULL DEFAULT now() CHECK (isfinite(observed_at))
);
CREATE INDEX IF NOT EXISTS idx_classification_correction_outcomes_observed
    ON classification_correction_outcomes (observed_at, correction_id);
COMMENT ON TABLE classification_correction_outcomes IS
    'Thirty-day explicit correction evaluation snapshots; no titles, metadata, actors, credentials, or routing authority. Survive history retries, cascade on destination deletion.';
