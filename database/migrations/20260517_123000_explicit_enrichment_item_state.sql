-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Migration: Explicit enrichment item/provider state
-- Purpose:
-- 1. Stop inferring media item enrichment completion solely from task completion
-- 2. Make deferred Tavily fallback explicit on the item row
-- 3. Separate provider outcome from overall enrichment workflow status

ALTER TABLE media_server_items
ADD COLUMN IF NOT EXISTS enrichment_provider_state VARCHAR(20) NOT NULL DEFAULT 'none',
ADD COLUMN IF NOT EXISTS enrichment_deferred_reason TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'media_server_items_enrichment_status_check'
    ) THEN
        ALTER TABLE media_server_items
        ADD CONSTRAINT media_server_items_enrichment_status_check
        CHECK (enrichment_status IN ('pending', 'processing', 'completed', 'deferred', 'failed'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'media_server_items_enrichment_provider_state_check'
    ) THEN
        ALTER TABLE media_server_items
        ADD CONSTRAINT media_server_items_enrichment_provider_state_check
        CHECK (enrichment_provider_state IN ('none', 'omdb', 'tavily', 'omdb+tavily'));
    END IF;
END $$;

WITH item_flags AS (
    SELECT
        msi.id,
        CASE
            WHEN msi.metadata->'omdb' IS NOT NULL
                 AND (
                    msi.metadata->'tavily_imdb' IS NOT NULL
                    OR msi.metadata->'tavily_advisory' IS NOT NULL
                    OR msi.metadata->'tavily_content_type' IS NOT NULL
                    OR msi.metadata->'tavily_holiday' IS NOT NULL
                    OR msi.metadata->'tavily_anime' IS NOT NULL
                 ) THEN 'omdb+tavily'
            WHEN msi.metadata->'omdb' IS NOT NULL THEN 'omdb'
            WHEN (
                msi.metadata->'tavily_imdb' IS NOT NULL
                OR msi.metadata->'tavily_advisory' IS NOT NULL
                OR msi.metadata->'tavily_content_type' IS NOT NULL
                OR msi.metadata->'tavily_holiday' IS NOT NULL
                OR msi.metadata->'tavily_anime' IS NOT NULL
            ) THEN 'tavily'
            ELSE 'none'
        END AS provider_state,
        EXISTS (
            SELECT 1
            FROM task_queue tq
            WHERE tq.task_type = 'metadata_enrichment'
              AND tq.status = 'processing'
              AND (
                ((tq.payload->>'itemId') ~ '^[0-9]+$' AND (tq.payload->>'itemId')::int = msi.id)
                OR ((tq.payload->>'media_item_id') ~ '^[0-9]+$' AND (tq.payload->>'media_item_id')::int = msi.id)
              )
        ) AS has_processing_task,
        EXISTS (
            SELECT 1
            FROM task_queue tq
            WHERE tq.task_type = 'metadata_enrichment'
              AND tq.status = 'pending'
              AND (
                ((tq.payload->>'itemId') ~ '^[0-9]+$' AND (tq.payload->>'itemId')::int = msi.id)
                OR ((tq.payload->>'media_item_id') ~ '^[0-9]+$' AND (tq.payload->>'media_item_id')::int = msi.id)
              )
        ) AS has_pending_task,
        EXISTS (
            SELECT 1
            FROM task_queue tq
            WHERE tq.task_type = 'metadata_enrichment'
              AND tq.status = 'failed'
              AND (
                ((tq.payload->>'itemId') ~ '^[0-9]+$' AND (tq.payload->>'itemId')::int = msi.id)
                OR ((tq.payload->>'media_item_id') ~ '^[0-9]+$' AND (tq.payload->>'media_item_id')::int = msi.id)
              )
        ) AS has_failed_task,
        EXISTS (
            SELECT 1
            FROM enrichment_retry_queue erq
            WHERE erq.media_item_id = msi.id
              AND erq.status = 'processing'
        ) AS has_processing_retry,
        EXISTS (
            SELECT 1
            FROM enrichment_retry_queue erq
            WHERE erq.media_item_id = msi.id
              AND erq.status = 'pending'
              AND erq.reason IS DISTINCT FROM 'tavily_monthly_quota_deferred'
        ) AS has_pending_retry,
        EXISTS (
            SELECT 1
            FROM enrichment_retry_queue erq
            WHERE erq.media_item_id = msi.id
              AND erq.status = 'pending'
              AND erq.reason = 'tavily_monthly_quota_deferred'
        ) AS has_deferred_retry,
        EXISTS (
            SELECT 1
            FROM enrichment_retry_queue erq
            WHERE erq.media_item_id = msi.id
              AND erq.status = 'failed'
        ) AS has_failed_retry
    FROM media_server_items msi
)
UPDATE media_server_items msi
SET enrichment_provider_state = flags.provider_state,
    enrichment_deferred_reason = CASE
        WHEN flags.has_deferred_retry THEN 'tavily_monthly_quota_deferred'
        ELSE NULL
    END,
    enrichment_status = CASE
        WHEN flags.has_processing_task OR flags.has_processing_retry THEN 'processing'
        WHEN flags.has_deferred_retry THEN 'deferred'
        WHEN flags.has_pending_task OR flags.has_pending_retry THEN 'pending'
        WHEN flags.provider_state <> 'none' THEN 'completed'
        WHEN flags.has_failed_task OR flags.has_failed_retry THEN 'failed'
        ELSE 'pending'
    END
FROM item_flags flags
WHERE msi.id = flags.id;

CREATE INDEX IF NOT EXISTS idx_media_server_items_enrichment_status
ON media_server_items (enrichment_status);

CREATE INDEX IF NOT EXISTS idx_media_server_items_enrichment_provider_state
ON media_server_items (enrichment_provider_state);

COMMENT ON COLUMN media_server_items.enrichment_status IS 'Explicit enrichment workflow state for the item (pending, processing, completed, deferred, failed).';
COMMENT ON COLUMN media_server_items.enrichment_provider_state IS 'Provider outcome currently persisted on the item row (none, omdb, tavily, omdb+tavily).';
COMMENT ON COLUMN media_server_items.enrichment_deferred_reason IS 'Explicit defer reason when enrichment is paused on an external dependency, such as Tavily monthly quota reset.';
