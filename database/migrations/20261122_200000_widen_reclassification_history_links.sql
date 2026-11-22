-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- The startup migration transaction commits the two History link types together.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE reclassification_move_operations ALTER COLUMN classification_id TYPE bigint;
ALTER TABLE reclassification_batch_items ALTER COLUMN classification_id TYPE bigint;
