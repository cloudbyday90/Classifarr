-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- The startup migration transaction owns the lock and rolls back on timeout.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE classification_intake_receipts ALTER COLUMN classification_id TYPE bigint;
