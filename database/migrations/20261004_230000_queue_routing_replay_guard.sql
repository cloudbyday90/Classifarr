-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
ALTER TABLE task_queue ADD COLUMN IF NOT EXISTS routing_classification_id bigint
    CHECK (routing_classification_id > 0);
COMMENT ON COLUMN task_queue.routing_classification_id IS
    'Durable automatic-routing write barrier for this command. Never reset on retry. No history FK: history retention must not remove replay protection.';
