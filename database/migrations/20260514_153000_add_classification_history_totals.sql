-- ============================================================================
-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
-- ============================================================================
-- Migration: 20260514_153000_add_classification_history_totals.sql
-- Purpose:
--   Maintain durable classification success/failure totals outside the hot
--   task_queue table so queue/dashboard summaries stay correct after queue
--   retention cleanup trims terminal queue rows.
--
-- Behavior:
--   - Creates classification_history_totals as a one-row aggregate table.
--   - Backfills current totals from classification_history.
--   - Adds a trigger to keep totals in sync on INSERT/UPDATE/DELETE.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.classification_history_totals (
    singleton boolean PRIMARY KEY DEFAULT TRUE CHECK (singleton = TRUE),
    successful_count bigint NOT NULL DEFAULT 0,
    failed_count bigint NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

INSERT INTO public.classification_history_totals (
    singleton,
    successful_count,
    failed_count,
    updated_at
)
SELECT
    TRUE,
    COUNT(*) FILTER (
        WHERE status IN ('completed', 'corrected', 'verified', 'reclassified', 'routed')
    )::bigint,
    COUNT(*) FILTER (
        WHERE status = 'failed'
    )::bigint,
    NOW()
FROM public.classification_history
ON CONFLICT (singleton) DO UPDATE
SET successful_count = EXCLUDED.successful_count,
    failed_count = EXCLUDED.failed_count,
    updated_at = NOW();

CREATE OR REPLACE FUNCTION public.sync_classification_history_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    old_is_success boolean := FALSE;
    new_is_success boolean := FALSE;
    old_is_failed boolean := FALSE;
    new_is_failed boolean := FALSE;
    success_delta integer := 0;
    failed_delta integer := 0;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        old_is_success := OLD.status = ANY (ARRAY['completed', 'corrected', 'verified', 'reclassified', 'routed']);
        old_is_failed := OLD.status = 'failed';
    END IF;

    IF TG_OP <> 'DELETE' THEN
        new_is_success := NEW.status = ANY (ARRAY['completed', 'corrected', 'verified', 'reclassified', 'routed']);
        new_is_failed := NEW.status = 'failed';
    END IF;

    success_delta := (CASE WHEN new_is_success THEN 1 ELSE 0 END)
        - (CASE WHEN old_is_success THEN 1 ELSE 0 END);
    failed_delta := (CASE WHEN new_is_failed THEN 1 ELSE 0 END)
        - (CASE WHEN old_is_failed THEN 1 ELSE 0 END);

    IF success_delta <> 0 OR failed_delta <> 0 THEN
        INSERT INTO public.classification_history_totals (
            singleton,
            successful_count,
            failed_count,
            updated_at
        )
        VALUES (TRUE, 0, 0, NOW())
        ON CONFLICT (singleton) DO NOTHING;

        UPDATE public.classification_history_totals
        SET successful_count = successful_count + success_delta,
            failed_count = failed_count + failed_delta,
            updated_at = NOW()
        WHERE singleton = TRUE;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS classification_history_totals_sync_trigger
    ON public.classification_history;

CREATE TRIGGER classification_history_totals_sync_trigger
AFTER INSERT OR UPDATE OF status OR DELETE
ON public.classification_history
FOR EACH ROW
EXECUTE FUNCTION public.sync_classification_history_totals();
