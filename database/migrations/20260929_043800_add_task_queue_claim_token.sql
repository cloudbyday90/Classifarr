-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Delivery ownership, not item identity. Legacy rows acquire a token only on dequeue.
-- All old worker instances must be stopped before starting token-aware workers.
ALTER TABLE task_queue ADD COLUMN IF NOT EXISTS claim_token UUID;
