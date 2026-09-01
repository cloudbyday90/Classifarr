-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- Serves only the fixed aggregate future-capture evaluator. It does not add
-- any content-bearing columns or broaden access to captured review rows.

CREATE INDEX IF NOT EXISTS idx_pccrc_capture_evaluation_active_revision
    ON policy_candidate_correction_review_corpus_captures (
        configuration_revision,
        expires_at ASC,
        score_margin_band_id ASC,
        selection_status_id ASC
    );
