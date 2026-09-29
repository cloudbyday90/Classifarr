-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Do not infer stopped ownership for legacy processing rows.
ALTER TABLE enrichment_retry_queue
    ADD COLUMN IF NOT EXISTS claim_token UUID,
    ADD COLUMN IF NOT EXISTS claim_until TIMESTAMPTZ;
