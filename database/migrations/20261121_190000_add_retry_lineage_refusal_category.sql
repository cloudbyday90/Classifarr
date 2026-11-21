-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0

ALTER TABLE task_queue ADD COLUMN retry_lineage_refusal_category text
    CHECK (retry_lineage_refusal_category IN (
        'proof_unavailable', 'source_relationship', 'item_identity', 'media_request_links', 'webhook_links'
    ));
