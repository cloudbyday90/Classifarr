-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- Keep one active pending decision for each unambiguous media identity. This
-- migration is intentionally conservative: only TMDB-backed rows receive a
-- historical identity key, so same-title items without a stable external or
-- media-server identifier are never merged automatically.

ALTER TABLE classification_history
    ADD COLUMN IF NOT EXISTS pending_identity_key VARCHAR(600);

COMMENT ON COLUMN classification_history.pending_identity_key IS
    'Stable unambiguous identity for the single active pending decision invariant.';

UPDATE classification_history
SET pending_identity_key = CONCAT('tmdb:', media_type, ':', tmdb_id)
WHERE tmdb_id IS NOT NULL
  AND pending_identity_key IS NULL;

-- Preserve every historical row and its foreign-keyed audit records. Only the
-- newest open decision stays actionable; older open decisions become a closed
-- reclassified record with explicit supersession provenance.
WITH ranked_pending AS (
    SELECT
        id,
        FIRST_VALUE(id) OVER (
            PARTITION BY pending_identity_key
            ORDER BY created_at DESC, id DESC
        ) AS current_id,
        ROW_NUMBER() OVER (
            PARTITION BY pending_identity_key
            ORDER BY created_at DESC, id DESC
        ) AS row_number
    FROM classification_history
    WHERE status IN ('awaiting_decision', 'pending_retry')
      AND pending_identity_key IS NOT NULL
), superseded_pending AS (
    SELECT id, current_id
    FROM ranked_pending
    WHERE row_number > 1
)
UPDATE classification_history AS history
SET status = 'reclassified',
    clarification_status = 'superseded',
    pending_reason = 'Superseded by a newer decision for the same media item',
    policy_question = NULL,
    metadata = jsonb_set(
        COALESCE(history.metadata, '{}'::jsonb),
        '{pending_decision_lifecycle}',
        jsonb_build_object(
            'version', 'classification.pending_decision_identity.v1',
            'state', 'superseded',
            'superseded_by_classification_id', superseded_pending.current_id,
            'superseded_at', NOW()
        ),
        true
    )
FROM superseded_pending
WHERE history.id = superseded_pending.id;

-- Historical notifications remain auditable but should no longer present as
-- unresolved work after their underlying decision has been superseded.
UPDATE app_notifications AS notification
SET is_read = true,
    read_at = COALESCE(read_at, NOW())
FROM classification_history AS history
WHERE history.clarification_status = 'superseded'
  AND notification.is_read = false
  AND notification.data IS NOT NULL
  AND notification.data->>'notificationType' = 'awaiting_decision'
  AND (notification.data->>'classificationId') ~ '^[0-9]+$'
  AND (notification.data->>'classificationId')::bigint = history.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_classification_history_active_pending_identity
    ON classification_history (pending_identity_key)
    WHERE status IN ('awaiting_decision', 'pending_retry')
      AND pending_identity_key IS NOT NULL;
