-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Bound the lock and table rewrite in the startup migration transaction.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE manual_routing_check_state ALTER COLUMN classification_id TYPE bigint;
