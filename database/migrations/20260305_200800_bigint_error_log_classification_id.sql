-- Migration: 20260305_200800_bigint_error_log_classification_id.sql
--
-- PURPOSE
-- Widens error_log.classification_id from INTEGER to BIGINT.
--
-- This column was missed by migration 20260305_200700_bigint_classification_history_pk.sql
-- because that migration discovers columns to widen via pg_constraint (FK-constrained
-- references to classification_history(id)).  error_log.classification_id is a loose
-- reference column with NO FK constraint — it stores a classification_history id for
-- logging context but does not enforce referential integrity.  The dynamic FK loop
-- therefore did not discover it.
--
-- Widening to BIGINT aligns it with classification_history.id (already BIGINT) and
-- prevents a type inconsistency that could cause implicit cast overhead on JOIN/filter
-- queries between error_log and classification_history.
--
-- SAFETY
-- No FK constraint exists on this column — the ALTER TABLE is straightforward.
-- The DO $$ guard makes the migration idempotent (safe to re-run).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'error_log'
       AND column_name  = 'classification_id'
       AND data_type    = 'integer'
  ) THEN
    ALTER TABLE error_log ALTER COLUMN classification_id TYPE bigint;
    RAISE NOTICE 'error_log.classification_id widened to bigint.';
  ELSE
    RAISE NOTICE 'error_log.classification_id is already bigint or does not exist — skipped.';
  END IF;
END $$;
