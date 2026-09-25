-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Add bounded categorical reasons without rewriting or discarding legacy history.
ALTER TABLE automatic_evaluation_history
    DROP CONSTRAINT IF EXISTS automatic_evaluation_history_result_check;
ALTER TABLE automatic_evaluation_history
    ADD CONSTRAINT automatic_evaluation_history_result_check CHECK (COALESCE((
        jsonb_typeof(result) = 'object'
        AND result->>'version' IN ('evaluation_history.v1', 'evaluation_history.v2')
        AND jsonb_typeof(result->'cases') = 'array'
        AND jsonb_array_length(result->'cases') <= 25
        AND octet_length(result::text) <= 16384
    ), false));
