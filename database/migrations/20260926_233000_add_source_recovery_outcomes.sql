-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- One latest outcome per bounded observation; no historical diagnosis backfill.
ALTER TABLE media_source_observations
    ADD COLUMN IF NOT EXISTS recovery_attempt_id uuid,
    ADD COLUMN IF NOT EXISTS recovery_attempted_at timestamptz,
    ADD COLUMN IF NOT EXISTS recovery_completed_at timestamptz,
    ADD COLUMN IF NOT EXISTS recovery_outcome text;
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='media_source_observations'::regclass
    AND conname='source_recovery_outcome_code') THEN
ALTER TABLE media_source_observations
    ADD CONSTRAINT source_recovery_outcome_code CHECK (recovery_outcome IN (
        'insufficient_evidence', 'adapter_unsupported', 'provider_unavailable',
        'provider_response_invalid', 'external_evidence_inconclusive', 'external_ids_disagree',
        'candidate_not_supported', 'title_year_mismatch', 'source_changed',
        'source_unavailable', 'internal_error', 'persistence_failed'
    ));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='media_source_observations'::regclass
    AND conname='source_recovery_outcome_shape') THEN
ALTER TABLE media_source_observations
    ADD CONSTRAINT source_recovery_outcome_shape CHECK (
        (recovery_attempt_id IS NULL) = (recovery_attempted_at IS NULL)
        AND (recovery_outcome IS NULL) = (recovery_completed_at IS NULL)
        AND (recovery_completed_at IS NULL OR recovery_attempted_at IS NULL
            OR recovery_completed_at >= recovery_attempted_at)
    );
END IF;
END $$;
