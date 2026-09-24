-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Prospective only. Mutable history cannot reconstruct an original decision.
ALTER TABLE classification_correction_outcomes
    ADD COLUMN IF NOT EXISTS decision_context jsonb;
ALTER TABLE classification_correction_outcomes
    ADD CONSTRAINT classification_correction_outcomes_decision_context_check
    CHECK (decision_context IS NULL OR
        (jsonb_typeof(decision_context) = 'object' AND octet_length(decision_context::text) <= 1024));
COMMENT ON COLUMN classification_correction_outcomes.decision_context IS
    'Versioned original saved decision and exact classification ID; no history FK, raw content, or routing authority. Null for unavailable historical context.';
